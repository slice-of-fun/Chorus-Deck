use rusqlite::{Connection, Result};
use std::collections::HashMap;
use std::time::{SystemTime, UNIX_EPOCH};

fn now_unix() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

pub struct LRUCache {
    max_size: usize,
    current_size: usize,
    entries: HashMap<String, CacheEntry>,
    conn: Connection,
}

struct CacheEntry {
    value: Vec<u8>,
    size: usize,
    expiry: i64,
}

impl LRUCache {
    pub fn new(max_size: usize, conn: Connection) -> Result<Self> {
        Self::ensure_table(&conn)?;
        Self::sweep_orphans(&conn)?;

        let mut entries: HashMap<String, CacheEntry> = HashMap::new();
        {
            let mut stmt = conn.prepare("SELECT key, value, size, expiry FROM cache")?;
            let rows = stmt.query_map([], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    CacheEntry {
                        value: row.get::<_, Vec<u8>>(1)?,
                        size: row.get::<_, i64>(2)?.max(0) as usize,
                        expiry: row.get::<_, i64>(3)?,
                    },
                ))
            })?;

            for row in rows.flatten() {
                entries.insert(row.0, row.1);
            }
        }

        let current_size = entries.values().map(|e| e.size).sum();

        Ok(LRUCache {
            max_size,
            current_size,
            entries,
            conn,
        })
    }

    fn ensure_table(conn: &Connection) -> Result<()> {
        conn.execute(
            "CREATE TABLE IF NOT EXISTS cache (
               key TEXT PRIMARY KEY,
               value BLOB,
               size INTEGER,
               expiry INTEGER
             )",
            [],
        )?;
        Ok(())
    }

    fn sweep_orphans(conn: &Connection) -> Result<usize> {
        let now = now_unix();
        Ok(conn.execute("DELETE FROM cache WHERE expiry > 0 AND expiry <= ?1", [now])?)
    }

    pub fn get(&mut self, key: &str) -> Option<Vec<u8>> {
        if let Some(entry) = self.entries.get(key) {
            if entry.expiry > 0 && now_unix() >= entry.expiry {
                self.remove(key);
                return None;
            }
            return Some(entry.value.clone());
        }

        let loaded = {
            let mut stmt = match self
                .conn
                .prepare("SELECT value, size, expiry FROM cache WHERE key = ?1")
            {
                Ok(s) => s,
                Err(_) => return None,
            };
            stmt.query_row([key], |row| {
                Ok(CacheEntry {
                    value: row.get::<_, Vec<u8>>(0)?,
                    size: row.get::<_, i64>(1)?.max(0) as usize,
                    expiry: row.get::<_, i64>(2)?,
                })
            })
            .ok()
        };

        let entry = loaded?;
        if entry.expiry > 0 && now_unix() >= entry.expiry {
            self.remove(key);
            return None;
        }

        let value = entry.value.clone();
        self.current_size += entry.size;
        self.entries.insert(key.to_string(), entry);
        self.evict_to_cap();
        Some(value)
    }

    pub fn set(&mut self, key: String, value: Vec<u8>, ttl_seconds: Option<i64>) {
        let size = value.len();

        if let Some(old) = self.entries.remove(&key) {
            self.current_size = self.current_size.saturating_sub(old.size);
            let _ = self
                .conn
                .execute("DELETE FROM cache WHERE key = ?1", [&key]);
        }

        let expiry = ttl_seconds.map(|t| now_unix() + t).unwrap_or(0);

        let _ = self.conn.execute(
            "INSERT OR REPLACE INTO cache (key, value, size, expiry) VALUES (?1, ?2, ?3, ?4)",
            rusqlite::params![key, value.as_slice(), size as i64, expiry],
        );

        self.current_size += size;
        self.entries.insert(
            key,
            CacheEntry {
                value,
                size,
                expiry,
            },
        );
        self.evict_to_cap();
    }

    fn remove(&mut self, key: &str) {
        if let Some(entry) = self.entries.remove(key) {
            self.current_size = self.current_size.saturating_sub(entry.size);
        }
        let _ = self.conn.execute("DELETE FROM cache WHERE key = ?1", [key]);
    }

    fn evict_to_cap(&mut self) {
        while self.current_size > self.max_size {
            let victim = match self
                .entries
                .iter()
                .min_by_key(|(_, e)| e.expiry)
                .map(|(k, _)| k.clone())
            {
                Some(k) => k,
                None => break,
            };
            self.remove(&victim);
        }
    }

    pub fn clear(&mut self) {
        self.entries.clear();
        self.current_size = 0;
        let _ = self.conn.execute("DELETE FROM cache", []);
    }

    pub fn len(&self) -> usize {
        self.entries.len()
    }

    pub fn is_empty(&self) -> bool {
        self.entries.is_empty()
    }

    pub fn size(&self) -> usize {
        self.current_size
    }

    pub fn max_size(&self) -> usize {
        self.max_size
    }
}
pub fn create_cache(max_size: usize, conn: Connection) -> Result<LRUCache> {
    LRUCache::new(max_size, conn)
}
