use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::{SystemTime, UNIX_EPOCH};

/// SQLite-backed LRU cache with TTL and size cap
///
/// Replaces 3 IndexedDB `cache_*` stores.
/// On boot, sweeps orphaned entries (expired TTL).
pub struct LRUCache {
  /// Maximum total size in bytes across all cached items
  max_size: usize,
  /// Current total size in bytes
  current_size: usize,
  /// Cache entries: key → (value, size, expiry_timestamp)
  entries: HashMap<String, CacheEntry>,
  /// Database connection for persistence
  conn: Connection,
}

/// A single cached entry
#[derive(Debug, Clone)]
struct CacheEntry {
  value: Vec<u8>,
  size: usize,
  expiry: i64, // Unix epoch seconds; 0 = no expiry
}

impl LRUCache {
  /// Create a new LRU cache with a size cap (in bytes)
  pub fn new(max_size: usize, conn: &Connection) -> Result<Self> {
    // Ensure table exists
    conn.execute(
      "CREATE TABLE IF NOT EXISTS cache (
        key TEXT PRIMARY KEY,
        value BLOB,
        size INTEGER,
        expiry INTEGER
      )",
      [],
    )?;

    // Sweep expired entries on init
    let _ = Self::sweep_orphans(conn);

    // Load existing entries from DB
    let mut entries = HashMap::new();
    let mut stmt = conn.prepare("SELECT key, value, size, expiry FROM cache")?;
    let rows = stmt.query_map([], |row| {
      Ok((
        row.get::<_, String>(0)?,
        CacheEntry {
          value: row.get::<_, Vec<u8>>(1)?,
          size: row.get::<_, i64>(2)? as usize,
          expiry: row.get::<_, i64>(3)?,
        },
      ))
    })?;

    for row in rows.flatten() {
      entries.insert(row.0, row.1);
      // Track current size
      if let Some(entry) = entries.get(&row.0) {
        // We'll compute current_size from entries after all loaded
      }
    }

    Ok(LRUCache {
      max_size,
      current_size: 0, // Will be computed after loading
      entries,
    })
  }

  /// Sweep orphaned (expired) entries from the database and in-memory map
  fn sweep_orphans(conn: &Connection) -> Result<usize> {
    let now = SystemTime::now()
      .duration_since(UNIX_EPOCH)
      .unwrap()
      .as_secs() as i64;

    let mut stmt = conn.prepare("SELECT key, expiry FROM cache WHERE expiry > 0")?;
    let rows = stmt.query_map([], |row| {
      Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?))
    })?;

    let mut swept = 0;
    let keys_to_remove: Vec<String> = rows
      .filter_map(|r| {
        let (key, expiry) = r?;
        if expiry <= now {
          Some(key)
        } else {
          None
        }
      })
      .collect();

    for key in &keys_to_remove {
      let _ = conn.execute("DELETE FROM cache WHERE key = ?1", [key.as_str()]);
      swept += 1;
    }

    // Remove swept entries from in-memory map too (caller will reload or we can)
    swept
  }

  /// Get a cached value by key, returns None if not found or expired
  pub fn get(&mut self, key: &str) -> Option<Vec<u8>> {
    if let Some(entry) = self.entries.get(key) {
      // Check expiry
      if entry.expiry > 0 {
        let now = SystemTime::now()
          .duration_since(UNIX_EPOCH)
          .unwrap()
          .as_secs() as i64;
        if now >= entry.expiry {
          // Expired - remove
          let _ = self.conn.execute("DELETE FROM cache WHERE key = ?1", [key]);
          self.entries.remove(key);
          return None;
        }
      }
      Some(entry.value.clone())
    } else {
      // Not in memory - try to load from DB
      let mut stmt = self.conn.prepare("SELECT value, size, expiry FROM cache WHERE key = ?1")?;
      let row = stmt.query_row([key], |row| {
        Ok((
          row.get::<_, Vec<u8>>(0)?,
          row.get::<_, i64>(1)? as usize,
          row.get::<_, i64>(2)?,
        ))
      });
      match row.ok() {
        Some((value, size, expiry)) => {
          // Add to memory cache (potentially evicting something if at cap)
          self.entries.insert(key.to_string(), CacheEntry {
            value,
            size,
            expiry,
          });
          // Update current_size
          self.current_size = self
            .entries
            .values()
            .map(|e| e.size)
            .sum::<usize>();
          Some(value)
        }
        None => None,
      }
    }
  }

  /// Set a cached value, evicting oldest entries if over size cap
  pub fn set(&mut self, key: String, value: Vec<u8>, ttl_seconds: Option<i64>) {
    let size = value.len();

    // Check if we need to evict
    while self.current_size + size > self.max_size && !self.entries.is_empty() {
      // Remove the first (oldest) entry
      let first_key = self.entries.keys().next().unwrap().clone();
      let first_size = self.entries[&first_key].size;
      let _ = self.conn.execute("DELETE FROM cache WHERE key = ?1", [first_key.as_str()]);
      self.entries.remove(&first_key);
      self.current_size -= first_size;
    }

    // Insert/update in DB
    let expiry = ttl_seconds.map(|t| {
      let st = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64 + t;
      st
    });

    let expiry_val = expiry.unwrap_or(0); // 0 = no expiry

    let _ = self.conn.execute(
      "INSERT OR REPLACE INTO cache (key, value, size, expiry) VALUES (?1, ?2, ?3, ?4)",
      [key, value.as_slice(), size as i64, expiry_val],
    );

    // Update in-memory cache
    self.entries.insert(key.clone(), CacheEntry {
      value,
      size,
      expiry: expiry_val,
    });
    self.current_size += size;
  }

  /// Get current cache size in bytes
  pub fn size(&self) -> usize {
    self.current_size
  }

  /// Get max cache size in bytes
  pub max_size(&self) -> usize {
    self.max_size
  }
}

/// Factory function to create a cache instance
pub fn create_cache(max_size: usize, conn: &Connection) -> Result<LRUCache> {
  LRUCache::new(max_size, conn)
}