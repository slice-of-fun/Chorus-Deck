export interface WordData {
  readonly text: string;

  readonly startTime: number;

  readonly duration: number;

  readonly space?: boolean;
}

export interface LyricLine {
  readonly startTime: number;

  readonly duration: number;

  readonly fullText: string;

  readonly words: readonly WordData[];
}

export interface MetaData {
  readonly time?: number;

  readonly content: string;
}

export interface ParsedLyrics {
  readonly metadata: readonly MetaData[];

  readonly lyrics: readonly LyricLine[];
}

export class LyricParseError extends Error {
  constructor(
    message: string,
    public readonly line?: string
  ) {
    super(message);
    this.name = 'LyricParseError';
  }
}

export type ParseResult<T> =
  { success: true; data: T } | { success: false; error: LyricParseError };

const METADATA_PATTERN = /^\{("t":|"c":)/;
const LINE_TIME_PATTERN = /^\[(\d+),(\d+)\](.+)$/;
const LRC_TIME_PATTERN = /^\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)$/;
const WORD_PATTERN = /\((\d+),(\d+),\d+\)([^(]*?)(?=\(|$)/g;

export const formatTime = (ms: number): string => {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const milliseconds = ms % 1000;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
};

const parseMetadata = (line: string): ParseResult<MetaData> => {
  try {
    const data = JSON.parse(line);

    if (typeof data !== 'object' || data === null) {
      return {
        success: false,
        error: new LyricParseError('Invalid metadata format: not a valid object', line)
      };
    }

    if (!Array.isArray(data.c)) {
      return {
        success: false,
        error: new LyricParseError('Invalid metadata format: missing c Field', line)
      };
    }

    if (data.t !== undefined && typeof data.t !== 'number') {
      return {
        success: false,
        error: new LyricParseError('Invalid metadata format:t Field must be numeric', line)
      };
    }

    const content = data.c
      .filter((item: any) => item && typeof item.tx === 'string')
      .map((item: any) => item.tx)
      .join('');

    return {
      success: true,
      data: {
        time: data.t,
        content
      }
    };
  } catch (error) {
    return {
      success: false,
      error: new LyricParseError(
        `JSONParsing failed: ${error instanceof Error ? error.message : 'unknown error'}`,
        line
      )
    };
  }
};

const parseLrcLine = (line: string): ParseResult<LyricLine> => {
  const lrcMatch = line.match(LRC_TIME_PATTERN);
  if (!lrcMatch) {
    return {
      success: false,
      error: new LyricParseError('LRCInvalid lyric line format: Unable to match time information', line)
    };
  }

  const minutes = parseInt(lrcMatch[1], 10);
  const seconds = parseInt(lrcMatch[2], 10);
  const milliseconds = parseInt(lrcMatch[3].padEnd(3, '0'), 10);
  const text = lrcMatch[4].trim();

  if (
    isNaN(minutes) ||
    isNaN(seconds) ||
    isNaN(milliseconds) ||
    minutes < 0 ||
    seconds < 0 ||
    milliseconds < 0 ||
    seconds >= 60
  ) {
    return {
      success: false,
      error: new LyricParseError('LRCInvalid lyric line format: invalid time value', line)
    };
  }

  const startTime = minutes * 60000 + seconds * 1000 + milliseconds;

  return {
    success: true,
    data: {
      startTime,
      duration: 0,
      fullText: text,
      words: []
    }
  };
};

const parseWordByWordLine = (line: string): ParseResult<LyricLine> => {
  const lineTimeMatch = line.match(LINE_TIME_PATTERN);
  if (!lineTimeMatch) {
    return {
      success: false,
      error: new LyricParseError('Invalid verbatim lyric line format: Unable to match time information', line)
    };
  }

  const startTime = parseInt(lineTimeMatch[1], 10);
  const duration = parseInt(lineTimeMatch[2], 10);
  const content = lineTimeMatch[3];

  if (isNaN(startTime) || isNaN(duration) || startTime < 0 || duration < 0) {
    return {
      success: false,
      error: new LyricParseError('Invalid verbatim lyric line format: Invalid time value', line)
    };
  }

  WORD_PATTERN.lastIndex = 0;

  const words: WordData[] = [];
  let match: RegExpExecArray | null;

  const rawTextParts: string[] = [];
  const tempWords: Array<{ startTime: number; duration: number; text: string }> = [];

  while ((match = WORD_PATTERN.exec(content)) !== null) {
    const wordStartTime = parseInt(match[1], 10);
    const wordDuration = parseInt(match[2], 10);
    const rawWordText = match[3];
    const wordText = rawWordText.trim();

    if (isNaN(wordStartTime) || isNaN(wordDuration)) {
      continue;
    }

    if (wordText) {
      tempWords.push({
        text: wordText,
        startTime: wordStartTime,
        duration: wordDuration
      });
      rawTextParts.push(rawWordText);
    }
  }

  const fullText = rawTextParts.join('').trim();

  let currentPos = 0;
  for (const word of tempWords) {
    const wordIndex = fullText.indexOf(word.text, currentPos);
    if (wordIndex === -1) {
      words.push(word);
      continue;
    }

    const wordEndPos = wordIndex + word.text.length;

    const hasSpace = wordEndPos < fullText.length && fullText[wordEndPos] === ' ';
    words.push({
      ...word,
      space: hasSpace
    });

    currentPos = wordEndPos;
  }

  return {
    success: true,
    data: {
      startTime,
      duration,
      fullText,
      words
    }
  };
};

const parseLyricLine = (line: string): ParseResult<LyricLine> => {
  if (LINE_TIME_PATTERN.test(line)) {
    return parseWordByWordLine(line);
  }

  if (LRC_TIME_PATTERN.test(line)) {
    return parseLrcLine(line);
  }

  return {
    success: false,
    error: new LyricParseError('Invalid lyric line format: does not match any known format', line)
  };
};

const calculateLrcDurations = (lyrics: LyricLine[]): LyricLine[] => {
  if (lyrics.length === 0) return lyrics;

  const updatedLyrics: LyricLine[] = [];

  for (let i = 0; i < lyrics.length; i++) {
    const currentLine = lyrics[i];

    if (currentLine.duration > 0) {
      updatedLyrics.push(currentLine);
      continue;
    }

    let duration = 0;
    if (i < lyrics.length - 1) {
      duration = lyrics[i + 1].startTime - currentLine.startTime;
    } else {
      duration = 3000;
    }

    duration = Math.max(duration, 0);

    updatedLyrics.push({
      ...currentLine,
      duration
    });
  }

  return updatedLyrics;
};

const parsePlainTextLine = (line: string): ParseResult<LyricLine> => {
  const text = line.replace(/\r/g, '').trim();

  if (!text) {
    return {
      success: false,
      error: new LyricParseError('Plain text lyrics line is empty', line)
    };
  }

  return {
    success: true,
    data: {
      startTime: -1,
      duration: 0,
      fullText: text,
      words: []
    }
  };
};

export const parseLyrics = (lyricsStr: string): ParseResult<ParsedLyrics> => {
  if (typeof lyricsStr !== 'string') {
    return {
      success: false,
      error: new LyricParseError('Input parameters must be strings')
    };
  }

  try {
    const lines = lyricsStr.trim().split('\n');
    const metadata: MetaData[] = [];
    const lyrics: LyricLine[] = [];
    const errors: LyricParseError[] = [];

    for (let i = 0; i < lines.length; i++) {
      const trimmedLine = lines[i].trim();
      if (!trimmedLine) continue;

      if (METADATA_PATTERN.test(trimmedLine)) {
        const result = parseMetadata(trimmedLine);
        if (result.success) {
          metadata.push(result.data);
        } else {
          errors.push(result.error);
        }
      } else if (trimmedLine.startsWith('[')) {
        const result = parseLyricLine(trimmedLine);
        if (result.success) {
          lyrics.push(result.data);
        } else {
          errors.push(result.error);
        }
      } else {
        const result = parsePlainTextLine(trimmedLine);
        if (result.success) {
          lyrics.push(result.data);
        } else {
          errors.push(result.error);
        }
      }
    }

    if (errors.length > 0 && errors.length > lines.length * 0.5) {
      return {
        success: false,
        error: new LyricParseError(
          `Parse failed: Too many error lines (${errors.length}/${lines.length}), the file format may be incorrect ${JSON.stringify(errors)}`
        )
      };
    }

    lyrics.sort((a, b) => {
      if (a.startTime === -1 && b.startTime === -1) return 0;
      if (a.startTime === -1) return -1;
      if (b.startTime === -1) return 1;
      return a.startTime - b.startTime;
    });

    const finalLyrics = calculateLrcDurations(lyrics);

    return {
      success: true,
      data: {
        metadata,
        lyrics: finalLyrics
      }
    };
  } catch (error) {
    return {
      success: false,
      error: new LyricParseError(
        `An error occurred during parsing: ${error instanceof Error ? error.message : 'unknown error'}`
      )
    };
  }
};

export default parseLyrics;
