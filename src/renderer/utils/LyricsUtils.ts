import Kuroshiro from 'kuroshiro';
// @ts-ignore
import KuromojiAnalyzer from 'kuroshiro-analyzer-kuromoji';
import { pinyin } from 'pinyin-pro';

export class LyricsUtils {
    private static KANA_ROMAJI_MAP: Record<string, string> = {
        "キャ": "kya", "キュ": "kyu", "キョ": "kyo",
        "シャ": "sha", "シュ": "shu", "ショ": "sho",
        "チャ": "cha", "チュ": "chu", "チョ": "cho",
        "ニャ": "nya", "ニュ": "nyu", "ニョ": "nyo",
        "ヒャ": "hya", "ヒュ": "hyu", "ヒョ": "hyo",
        "ミャ": "mya", "ミュ": "myu", "ミョ": "myo",
        "リャ": "rya", "リュ": "ryu", "リョ": "ryo",
        "ギャ": "gya", "ギュ": "gyu", "ギョ": "gyo",
        "ジャ": "ja", "ジュ": "ju", "ジョ": "jo",
        "ヂャ": "ja", "ヂュ": "ju", "ヂョ": "jo",
        "ビャ": "bya", "ビュ": "byu", "ビョ": "byo",
        "ピャ": "pya", "ピュ": "pyu", "ピョ": "pyo",
        
        "ア": "a", "イ": "i", "ウ": "u", "エ": "e", "オ": "o",
        "カ": "ka", "キ": "ki", "ク": "ku", "ケ": "ke", "コ": "ko",
        "サ": "sa", "シ": "shi", "ス": "su", "セ": "se", "ソ": "so",
        "タ": "ta", "チ": "chi", "ツ": "tsu", "テ": "te", "ト": "to",
        "ナ": "na", "ニ": "ni", "ヌ": "nu", "ネ": "ne", "ノ": "no",
        "ハ": "ha", "ヒ": "hi", "フ": "fu", "ヘ": "he", "ホ": "ho",
        "マ": "ma", "ミ": "mi", "ム": "mu", "メ": "me", "モ": "mo",
        "ヤ": "ya", "ユ": "yu", "ヨ": "yo",
        "ラ": "ra", "リ": "ri", "ル": "ru", "レ": "re", "ロ": "ro",
        "ワ": "wa", "ヲ": "o", "ン": "n",
        
        "ガ": "ga", "ギ": "gi", "グ": "gu", "ゲ": "ge", "ゴ": "go",
        "ザ": "za", "ジ": "ji", "ズ": "zu", "ゼ": "ze", "ゾ": "zo",
        "ダ": "da", "ヂ": "ji", "ヅ": "zu", "デ": "de", "ド": "do",
        
        "バ": "ba", "ビ": "bi", "ブ": "bu", "ベ": "be", "ボ": "bo",
        "パ": "pa", "ピ": "pi", "プ": "pu", "ペ": "pe", "ポ": "po",
        
        "ー": ""
    };

    private static HANGUL_ROMAJA_MAP: Record<string, Record<string, string>> = {
        "cho": {
            "ᄀ": "g", "ᄁ": "kk", "ᄂ": "n", "ᄃ": "d",
            "ᄄ": "tt", "ᄅ": "r", "ᄆ": "m", "ᄇ": "b",
            "ᄈ": "pp", "ᄉ": "s", "ᄊ": "ss", "ᄋ": "",
            "ᄌ": "j", "ᄍ": "jj", "ᄎ": "ch", "ᄏ": "k",
            "ᄐ": "t", "ᄑ": "p", "ᄒ": "h"
        },
        "jung": {
            "ᅡ": "a", "ᅢ": "ae", "ᅣ": "ya", "ᅤ": "yae",
            "ᅥ": "eo", "ᅦ": "e", "ᅧ": "yeo", "ᅨ": "ye",
            "ᅩ": "o", "ᅪ": "wa", "ᅫ": "wae", "ᅬ": "oe",
            "ᅭ": "yo", "ᅮ": "u", "ᅯ": "wo", "ᅰ": "we",
            "ᅱ": "wi", "ᅲ": "yu", "ᅳ": "eu", "ᅴ": "eui",
            "ᅵ": "i"
        },
        "jong": {
            "ᆨ": "k", "ᆨᄋ": "g", "ᆨᄂ": "ngn", "ᆨᄅ": "ngn", "ᆨᄆ": "ngm", "ᆨᄒ": "kh",
            "ᆩ": "kk", "ᆩᄋ": "kg", "ᆩᄂ": "ngn", "ᆩᄅ": "ngn", "ᆩᄆ": "ngm", "ᆩᄒ": "kh",
            "ᆪ": "k", "ᆪᄋ": "ks", "ᆪᄂ": "ngn", "ᆪᄅ": "ngn", "ᆪᄆ": "ngm", "ᆪᄒ": "kch",
            "ᆫ": "n", "ᆫᄅ": "ll", "ᆬ": "n", "ᆬᄋ": "nj", "ᆬᄂ": "nn", "ᆬᄅ": "nn",
            "ᆬᄆ": "nm", "ᆬㅎ": "nch", "ᆭ": "n", "ᆭᄋ": "nh", "ᆭᄅ": "nn", "ᆮ": "t",
            "ᆮᄋ": "d", "ᆮᄂ": "nn", "ᆮᄅ": "nn", "ᆮᄆ": "nm", "ᆮᄒ": "th", "ᆯ": "l",
            "ᆯᄋ": "r", "ᆯᄂ": "ll", "ᆯᄅ": "ll", "ᆰ": "k", "ᆰᄋ": "lg", "ᆰᄂ": "ngn",
            "ᆰᄅ": "ngn", "ᆰᄆ": "ngm", "ᆰᄒ": "lkh", "ᆱ": "m", "ᆱᄋ": "lm", "ᆱᄂ": "mn",
            "ᆱᄅ": "mn", "ᆱᄆ": "mm", "ᆱᄒ": "lmh", "ᆲ": "p", "ᆲᄋ": "lb", "ᆲᄂ": "mn",
            "ᆲᄅ": "mn", "ᆲᄆ": "mm", "ᆲᄒ": "lph", "ᆳ": "t", "ᆳᄋ": "ls", "ᆳᄂ": "nn",
            "ᆳᄅ": "nn", "ᆳᄆ": "nm", "ᆳᄒ": "lsh", "ᆴ": "t", "ᆴᄋ": "lt", "ᆴᄂ": "nn",
            "ᆴᄅ": "nn", "ᆴᄆ": "nm", "ᆴᄒ": "lth", "ᆵ": "p", "ᆵᄋ": "lp", "ᆵᄂ": "mn",
            "ᆵᄅ": "mn", "ᆵᄆ": "mm", "ᆵᄒ": "lph", "ᆶ": "l", "ᆶᄋ": "lh", "ᆶᄂ": "ll",
            "ᆶᄅ": "ll", "ᆶᄆ": "lm", "ᆶᄒ": "lh", "ᆷ": "m", "ᆷᄅ": "mn", "ᆸ": "p",
            "ᆸᄋ": "b", "ᆸᄂ": "mn", "ᆸᄅ": "mn", "ᆸᄆ": "mm", "ᆸᄒ": "ph", "ᆹ": "p",
            "ᆹᄋ": "ps", "ᆹᄂ": "mn", "ᆹᄅ": "mn", "ᆹᄆ": "mm", "ᆹᄒ": "psh", "ᆺ": "t",
            "ᆺᄋ": "s", "ᆺᄂ": "nn", "ᆺᄅ": "nn", "ᆺᄆ": "nm", "ᆺᄒ": "sh", "ᆻ": "t",
            "ᆻᄋ": "ss", "ᆻᄂ": "tn", "ᆻᄅ": "tn", "ᆻᄆ": "nm", "ᆻᄒ": "th", "ᆼ": "ng",
            "ᆽ": "t", "ᆽᄋ": "j", "ᆽᄂ": "nn", "ᆽᄅ": "nn", "ᆽᄆ": "nm", "ᆽᄒ": "ch",
            "ᆾ": "t", "ᆾᄋ": "ch", "ᆾᄂ": "nn", "ᆾᄅ": "nn", "ᆾᄆ": "nm", "ᆾᄒ": "ch",
            "ᆿ": "k", "ᆿᄋ": "k", "ᆿᄂ": "ngn", "ᆿᄅ": "ngn", "ᆿᄆ": "ngm", "ᆿᄒ": "kh",
            "ᇀ": "t", "ᇀᄋ": "t", "ᇀᄂ": "nn", "ᇀᄅ": "nn", "ᇀᄆ": "nm", "ᇀᄒ": "th",
            "ᇁ": "p", "ᇁᄋ": "p", "ᇁᄂ": "mn", "ᇁᄅ": "mn", "ᇁᄆ": "mm", "ᇁᄒ": "ph",
            "ᇂ": "t", "ᇂᄋ": "h", "ᇂᄂ": "nn", "ᇂᄅ": "nn", "ᇂᄆ": "mm", "ᇂᄒ": "t",
            "ᇂᄀ": "k"
        }
    };

    private static DEVANAGARI_ROMAJI_MAP: Record<string, string> = {
        "अ": "a", "आ": "aa", "इ": "i", "ई": "ee", "उ": "u", "ऊ": "oo",
        "ऋ": "ri", "ए": "e", "ऐ": "ai", "ओ": "o", "औ": "au",
        "क": "k", "ख": "kh", "ग": "g", "घ": "gh", "ङ": "ng",
        "च": "ch", "छ": "chh", "ज": "j", "झ": "jh", "ञ": "ny",
        "ट": "t", "ठ": "th", "ड": "d", "ढ": "dh", "ण": "n",
        "त": "t", "थ": "th", "द": "d", "ध": "dh", "न": "n",
        "प": "p", "फ": "ph", "ब": "b", "भ": "bh", "म": "m",
        "य": "y", "र": "r", "ल": "l", "व": "v",
        "श": "sh", "ष": "sh", "स": "s", "ह": "h",
        "क्ष": "ksh", "त्र": "tr", "ज्ञ": "gy", "श्र": "shr",
        "ा": "aa", "ि": "i", "ी": "ee", "ु": "u", "ू": "oo",
        "ृ": "ri", "े": "e", "ै": "ai", "ो": "o", "ौ": "au",
        "ं": "n", "ः": "h", "ँ": "n", "़": "", "्": "",
        "०": "0", "१": "1", "२": "2", "३": "3", "४": "4",
        "५": "5", "६": "6", "७": "7", "८": "8", "९": "9",
        "ॐ": "Om", "ऽ": "",
        "क़": "q", "ख़": "kh", "ग़": "g", "ज़": "z", "ड़": "r", "ढ़": "rh", "फ़": "f", "य़": "y",
        "क\u093C": "q", "ख\u093C": "kh", "ग\u093C": "g", "ज\u093C": "z", "ड\u093C": "r", "ढ\u093C": "rh", "फ\u093C": "f", "य\u093C": "y"
    };

    private static GURMUKHI_ROMAJI_MAP: Record<string, string> = {
        "ੳ": "o", "ਅ": "a", "ੲ": "e", "ਸ": "s", "ਹ": "h",
        "ਕ": "k", "ਖ": "kh", "ਗ": "g", "ਘ": "gh", "ਙ": "ng",
        "ਚ": "ch", "ਛ": "chh", "ਜ": "j", "ਝ": "jh", "ਞ": "ny",
        "ਟ": "t", "ਠ": "th", "ڈ": "d", "ਢ": "dh", "ਣ": "n",
        "ਤ": "t", "ਥ": "th", "ਦ": "d", "ਧ": "dh", "ਨ": "n",
        "ਪ": "p", "ਫ": "ph", "ਬ": "b", "ਭ": "bh", "ਮ": "m",
        "ਯ": "y", "ਰ": "r", "ਲ": "l", "ਵ": "v", "ੜ": "r",
        "ਸ਼": "sh", "ਖ਼": "kh", "ਗ਼": "g", "ਜ਼": "z", "ਫ਼": "f", "ਲ਼": "l",
        "ਾ": "aa", "ਿ": "i", "ੀ": "ee", "ੁ": "u", "ੂ": "oo",
        "ੇ": "e", "ੈ": "ai", "ੋ": "o", "ੌ": "au",
        "ੰ": "n", "ਂ": "n", "ੱ": "", "੍": "", "਼": "",
        "ੴ": "Ek Onkar",
        "੦": "0", "੧": "1", "੨": "2", "੩": "3", "੪": "4",
        "੫": "5", "੬": "6", "੭": "7", "੮": "8", "੯": "9"
    };

    private static GENERAL_CYRILLIC_ROMAJI_MAP: Record<string, string> = {
        "А": "A", "Б": "B", "В": "V", "Г": "G", "Ґ": "G", "Д": "D",
        "Ѓ": "Ǵ", "Ђ": "Đ", "Е": "E", "Ё": "Yo", "Є": "Ye", "Ж": "Zh",
        "З": "Z", "Ѕ": "Dz", "И": "I", "І": "I", "Ї": "Yi", "Й": "Y",
        "Ј": "Y", "К": "K", "Л": "L", "Љ": "Ly", "М": "M", "Н": "N",
        "Њ": "Ny", "О": "O", "П": "P", "Р": "R", "С": "S", "Т": "T",
        "Ћ": "Ć", "У": "U", "Ў": "Ŭ", "Ф": "F", "Х": "Kh", "Ц": "Ts",
        "Ч": "Ch", "Џ": "Dž", "Ш": "Sh", "Щ": "Shch", "Ъ": "ʺ", "Ы": "Y",
        "Ь": "ʹ", "Э": "E", "Ю": "Yu", "Я": "Ya",
        "Ѡ": "O", "Ѣ": "Ya", "Ѥ": "Ye", "Ѧ": "Ya", "Ѩ": "Ya",
        "Ѫ": "U", "Ѭ": "Yu", "Ѯ": "Ks", "Ѱ": "Ps", "Ѳ": "F",
        "Ѵ": "I", "Ѷ": "I", "Ғ": "Gh", "Ҕ": "G", "Җ": "Zh",
        "Ҙ": "Dz", "Қ": "Q", "Ҝ": "K", "Ҟ": "K", "Ҡ": "K",
        "Ң": "Ng", "Ҥ": "Ng", "Ҧ": "P", "Ҩ": "O", "Ҫ": "S",
        "Ҭ": "T", "Ү": "U", "Ұ": "U", "Ҳ": "Kh", "Ҵ": "Ts",
        "Ҷ": "Ch", "Ҹ": "Ch", "Һ": "H", "Ҽ": "Ch", "Ҿ": "Ch",
        "Ќ": "Ḱ", "Ө": "Ö",

        "а": "a", "б": "b", "в": "v", "г": "g", "ґ": "g", "д": "d",
        "ѓ": "ǵ", "ђ": "đ", "е": "e", "ё": "yo", "є": "ye", "ж": "zh",
        "з": "z", "ѕ": "dz", "и": "i", "і": "i", "ї": "yi", "й": "y",
        "ј": "y", "к": "k", "л": "l", "љ": "ly", "м": "m", "н": "n",
        "њ": "ny", "о": "o", "п": "p", "р": "r", "с": "s", "т": "t",
        "ћ": "ć", "у": "u", "ў": "ŭ", "ф": "f", "х": "kh", "ц": "ts",
        "ч": "ch", "џ": "dž", "ш": "sh", "щ": "shch", "ъ": "ʺ", "ы": "y",
        "ь": "ʹ", "э": "e", "ю": "yu", "я": "ya",
        "ѡ": "o", "ѣ": "ya", "ѥ": "ye", "ѧ": "ya", "ѩ": "ya",
        "ѫ": "u", "ѭ": "yu", "ѯ": "ks", "ѱ": "ps", "ѳ": "f",
        "ѵ": "i", "ѷ": "i", "ғ": "gh", "ҕ": "g", "җ": "zh",
        "ҙ": "dz", "қ": "q", "ҝ": "k", "ҟ": "k", "ҡ": "k",
        "ң": "ng", "ҥ": "ng", "ҧ": "p", "ҩ": "o", "ҫ": "s",
        "ҭ": "t", "ү": "u", "ұ": "u", "ҳ": "kh", "ҵ": "ts",
        "ҷ": "ch", "ҹ": "ch", "һ": "h", "ҽ": "ch", "ҿ": "ch",
        "ќ": "ḱ", "ө": "ö"
    };

    private static RUSSIAN_ROMAJI_MAP: Record<string, string> = {
        "ого": "ovo", "Ого": "Ovo", "его": "evo", "Его": "Evo"
    };

    private static UKRAINIAN_ROMAJI_MAP: Record<string, string> = {
        "Г": "H", "г": "h",
        "Ґ": "G", "ґ": "g",
        "Є": "Ye", "є": "ye",
        "І": "I", "і": "i",
        "Ї": "Yi", "ї": "yi"
    };

    private static SERBIAN_ROMAJI_MAP: Record<string, string> = {
        "Ж": "Ž", "Љ": "Lj", "Њ": "Nj", "Ц": "C", "Ч": "Č",
        "Џ": "Dž", "Ш": "Š", "Х": "H",
        "ж": "ž", "љ": "lj", "њ": "nj", "ц": "c", "ч": "č",
        "џ": "dž", "ш": "š", "х": "h"
    };

    private static BULGARIAN_ROMAJI_MAP: Record<string, string> = {
        "Ж": "Zh", "Ц": "Ts", "Ч": "Ch", "Ш": "Sh", "Щ": "Sht",
        "Ъ": "A", "Ь": "Y", "Ю": "Yu", "Я": "Ya",
        "ж": "zh", "ц": "ts", "ч": "ch", "ш": "sh", "щ": "sht",
        "ъ": "a", "ь": "y", "ю": "yu", "я": "ya"
    };

    private static BELARUSIAN_ROMAJI_MAP: Record<string, string> = {
        "Г": "H", "г": "h", "Ў": "W", "ў": "w"
    };

    private static KYRGYZ_ROMAJI_MAP: Record<string, string> = {
        "Ү": "Ü", "ү": "ü", "Ы": "Y", "ы": "y"
    };

    private static MACEDONIAN_ROMAJI_MAP: Record<string, string> = {
        "Ѓ": "Gj", "Ѕ": "Dz", "И": "I", "Ј": "J", "Љ": "Lj",
        "Њ": "Nj", "Ќ": "Kj", "Џ": "Dž", "Ч": "Č", "Ш": "Sh",
        "Ж": "Zh", "Ц": "C", "Х": "H",
        "ѓ": "gj", "ѕ": "dz", "и": "i", "ј": "j", "љ": "lj",
        "њ": "nj", "ќ": "kj", "џ": "dž", "ч": "č", "ш": "sh",
        "ж": "zh", "ц": "c", "х": "h"
    };

    private static RUSSIAN_CYRILLIC_LETTERS = new Set([
        "А", "Б", "В", "Г", "Д", "Е", "Ё", "Ж", "З", "И", "Й", "К", "Л", "М", "Н",
        "О", "П", "Р", "С", "Т", "У", "Ф", "Х", "Ц", "Ч", "Ш", "Щ", "Ъ", "Ы", "Ь",
        "Э", "Ю", "Я",
        "а", "б", "в", "г", "д", "е", "ё", "ж", "з", "и", "й", "к", "л", "м", "н",
        "о", "п", "р", "с", "т", "у", "ф", "х", "ц", "ч", "ш", "щ", "ъ", "ы", "ь",
        "э", "ю", "я"
    ]);

    private static UKRAINIAN_CYRILLIC_LETTERS = new Set([
       "А", "Б", "В", "Г", "Ґ", "Д", "Е", "Є", "Ж", "З", "И", "І", "Ї", "Й",
        "К", "Л", "М", "Н", "О", "П", "Р", "С", "Т", "У", "Ф", "Х", "Ц", "Ч",
        "Ш", "Щ", "Ь", "Ю", "Я",
        "а", "б", "в", "г", "ґ", "д", "е", "є", "ж", "з", "и", "і", "ї", "й",
        "к", "л", "м", "н", "о", "п", "р", "с", "т", "у", "ф", "х", "ц", "ч",
        "ш", "щ", "ь", "ю", "я"
    ]);

    private static SERBIAN_CYRILLIC_LETTERS = new Set([
        "А", "Б", "В", "Г", "Д", "Ђ", "Е", "Ж", "З", "И", "Ј", "К", "Л", "Љ", "М",
        "Н", "Њ", "О", "П", "Р", "С", "Т", "Ћ", "У", "Ф", "Х", "Ц", "Ч", "Џ", "Ш",
        "а", "б", "в", "г", "д", "ђ", "е", "ж", "з", "и", "ј", "к", "л", "љ", "м",
        "н", "њ", "о", "п", "р", "с", "т", "ћ", "у", "ф", "х", "ц", "ч", "џ", "ш"
    ]);

    private static BULGARIAN_CYRILLIC_LETTERS = new Set([
        "А", "Б", "В", "Г", "Д", "Е", "Ж", "З", "И", "Й", "К", "Л", "М",
        "Н", "О", "П", "Р", "С", "Т", "У", "Ф", "Х", "Ц", "Ч", "Ш", "Щ",
        "Ъ", "Ь", "Ю", "Я",
        "а", "б", "в", "г", "д", "е", "ж", "з", "и", "й", "к", "л", "м",
        "н", "о", "п", "р", "с", "т", "у", "ф", "х", "ц", "ч", "ш", "щ",
        "ъ", "ь", "ю", "я"
    ]);

    private static BELARUSIAN_CYRILLIC_LETTERS = new Set([
        "А", "Б", "В", "Г", "Д", "Е", "Ё", "Ж", "З", "І", "Й", "К", "Л", "М", "Н",
        "О", "П", "Р", "С", "Т", "У", "Ў", "Ф", "Х", "Ц", "Ч", "Ш", "Ь", "Ю", "Я",
        "Ы", "Э",
        "а", "б", "в", "г", "д", "е", "ё", "ж", "з", "і", "й", "к", "л", "м", "н",
        "о", "п", "р", "с", "т", "у", "ў", "ф", "х", "ц", "ч", "ш", "ь", "ю", "я",
        "ы", "э"
    ]);

    private static KYRGYZ_CYRILLIC_LETTERS = new Set([
        "А", "Б", "В", "Г", "Д", "Е", "Ё", "Ж", "З", "И", "Й", "К", "Л", "М", "Н",
        "Ң", "О", "Ө", "П", "Р", "С", "Т", "У", "Ү", "Ф", "Х", "Ц", "Ч", "Ш", "Щ",
        "Ъ", "Ы", "Ь", "Э", "Ю", "Я",
        "а", "б", "в", "г", "д", "е", "ё", "ж", "з", "и", "й", "к", "л", "м", "н",
        "ң", "о", "ө", "п", "р", "с", "т", "у", "ү", "ф", "х", "ц", "ч", "ш", "щ",
        "ъ", "ы", "ь", "э", "ю", "я"
    ]);

    private static MACEDONIAN_CYRILLIC_LETTERS = new Set([
        "А", "Б", "В", "Г", "Д", "Ѓ", "Е", "Ж", "З", "Ѕ", "И", "Ј", "К", "Л",
        "Љ", "М", "Н", "Њ", "О", "П", "Р", "С", "Т", "Ќ", "У", "Ф", "Х",
        "Ц", "Ч", "Џ", "Ш",
        "а", "б", "в", "г", "д", "ѓ", "е", "ж", "з", "ѕ", "и", "ј", "к", "л",
        "љ", "м", "н", "њ", "о", "п", "р", "с", "т", "ќ", "у", "ф", "х",
        "ц", "ч", "џ", "ш"
    ]);

    private static UKRAINIAN_SPECIFIC_CYRILLIC_LETTERS = new Set([
        "Ґ", "ґ", "Є", "є", "І", "і", "Ї", "ї"
    ]);

    private static SERBIAN_SPECIFIC_CYRILLIC_LETTERS = new Set([
        "Ђ", "ђ", "Ј", "ј", "Љ", "љ", "Њ", "њ", "Ћ", "ћ", "Џ", "џ"
    ]);

    private static BELARUSIAN_SPECIFIC_CYRILLIC_LETTERS = new Set([
        "Ў", "ў", "І", "і"
    ]);

    private static KYRGYZ_SPECIFIC_CYRILLIC_LETTERS = new Set([
        "Ң", "ң", "Ө", "ө", "Ү", "ү"
    ]);

    private static MACEDONIAN_SPECIFIC_CYRILLIC_LETTERS = new Set([
        "Ѓ", "ѓ", "Ѕ", "ѕ", "Ќ", "ќ"
    ]);


    private static kuroshiroInstance: any = null;

    private static async initKuroshiro() {
        if (!this.kuroshiroInstance) {
            this.kuroshiroInstance = new Kuroshiro();
            await this.kuroshiroInstance.init(new KuromojiAnalyzer());
        }
    }

    public static async romanizeJapanese(text: string): Promise<string> {
        try {
            await this.initKuroshiro();
            return await this.kuroshiroInstance.convert(text, { to: "romaji", mode: "spaced" });
        } catch (e) {
            console.error("Kuroshiro initialization or conversion failed", e);
            return this.katakanaToRomaji(text);
        }
    }

    public static katakanaToRomaji(katakana: string): string {
        if (!katakana) return "";
        let romajiBuilder = "";
        let i = 0;
        const n = katakana.length;
        
        while (i < n) {
            let consumed = false;
            if (i + 1 < n) {
                const twoCharCandidate = katakana.substring(i, i + 2);
                const mappedTwoChar = this.KANA_ROMAJI_MAP[twoCharCandidate];
                if (mappedTwoChar) {
                    romajiBuilder += mappedTwoChar;
                    i += 2;
                    consumed = true;
                }
            }
            if (!consumed && katakana[i] === 'ッ') {
                const nextCharToDouble = katakana[i + 1];
                if (nextCharToDouble) {
                    const nextCharRomaji = this.KANA_ROMAJI_MAP[nextCharToDouble]?.[0] || nextCharToDouble;
                    romajiBuilder += nextCharRomaji.toLowerCase().trim();
                }
                i += 1;
                consumed = true;
            }
            if (!consumed) {
                const oneCharCandidate = katakana[i];
                const mappedOneChar = this.KANA_ROMAJI_MAP[oneCharCandidate];
                if (mappedOneChar) {
                    romajiBuilder += mappedOneChar;
                } else {
                    romajiBuilder += oneCharCandidate;
                }
                i += 1;
            }
        }
        return romajiBuilder.toLowerCase();
    }

    public static async romanizeChinese(text: string): Promise<string> {
        if (!text) return "";
        return pinyin(text, { toneType: 'none', nonZh: 'consecutive', v: true });
    }

    public static async romanizeKorean(text: string): Promise<string> {
        let romajaBuilder = "";
        let prevFinal: string | null = null;

        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            const charCode = char.charCodeAt(0);
            
            if (charCode >= 0xAC00 && charCode <= 0xD7A3) {
                const syllableIndex = charCode - 0xAC00;
                const choIndex = Math.floor(syllableIndex / (21 * 28));
                const jungIndex = Math.floor((syllableIndex % (21 * 28)) / 28);
                const jongIndex = syllableIndex % 28;

                const choChar = String.fromCharCode(0x1100 + choIndex);
                const jungChar = String.fromCharCode(0x1161 + jungIndex);
                const jongChar = jongIndex === 0 ? null : String.fromCharCode(0x11A7 + jongIndex);

                if (prevFinal !== null) {
                    const contextKey = prevFinal + choChar;
                    const jong = this.HANGUL_ROMAJA_MAP["jong"][contextKey] || 
                                 this.HANGUL_ROMAJA_MAP["jong"][prevFinal] || 
                                 prevFinal;
                    romajaBuilder += jong;
                }

                const cho = this.HANGUL_ROMAJA_MAP["cho"][choChar] || choChar;
                const jung = this.HANGUL_ROMAJA_MAP["jung"][jungChar] || jungChar;
                romajaBuilder += cho + jung;
                prevFinal = jongChar;
            } else {
                if (prevFinal !== null) {
                    const jong = this.HANGUL_ROMAJA_MAP["jong"][prevFinal] || prevFinal;
                    romajaBuilder += jong;
                    prevFinal = null;
                }
                romajaBuilder += char;
            }
        }

        if (prevFinal !== null) {
            const jong = this.HANGUL_ROMAJA_MAP["jong"][prevFinal] || prevFinal;
            romajaBuilder += jong;
        }

        return romajaBuilder;
    }


    private static isCyrillicVowel(char: string): boolean {
        return "АаЕеЄєИиІіЇїОоУуЮюЯяЫыЭэ".includes(char);
    }

    private static romanizeRussianInternal(text: string): string {
        let romajiBuilder = "";
        const words = text.split(/((?=\s|[.,!?;])|(?<=\s|[.,!?;]))/g).filter(Boolean);
        
        for (const word of words) {
            if (/^[.,!?;]$/.test(word) || !word.trim()) {
                romajiBuilder += word;
            } else {
                let charIndex = 0;
                while (charIndex < word.length) {
                    let consumed = false;
                    
                    if (charIndex + 2 < word.length) {
                        const threeCharCandidate = word.substring(charIndex, charIndex + 3);
                        if (this.RUSSIAN_ROMAJI_MAP[threeCharCandidate]) {
                            romajiBuilder += this.RUSSIAN_ROMAJI_MAP[threeCharCandidate];
                            charIndex += 3;
                            consumed = true;
                        }
                    }

                    if (!consumed) {
                        const charStr = word[charIndex];
                        if ((charStr === "е" || charStr === "Е") && (charIndex === 0 || /\s/.test(word[charIndex - 1] || ""))) {
                            romajiBuilder += charStr === "е" ? "ye" : "Ye";
                        } else {
                            const romanizedChar = this.GENERAL_CYRILLIC_ROMAJI_MAP[charStr] || charStr;
                            romajiBuilder += romanizedChar;
                        }
                        charIndex += 1;
                    }
                }
            }
        }
        return romajiBuilder;
    }

    private static romanizeUkrainianInternal(text: string): string {
        let romajiBuilder = "";
        const words = text.split(/((?=\s|[.,!?;])|(?<=\s|[.,!?;]))/g).filter(Boolean);

        for (const word of words) {
            if (/^[.,!?;]$/.test(word) || !word.trim()) {
                romajiBuilder += word;
            } else {
                let charIndex = 0;
                while (charIndex < word.length) {
                    const charStr = word[charIndex];
                    let processed = false;

                    if (charIndex > 0 && /\p{L}/u.test(word[charIndex - 1]) && !this.isCyrillicVowel(word[charIndex - 1])) {
                        if (charStr === "Ю") {
                            romajiBuilder += "Iu";
                            processed = true;
                        } else if (charStr === "ю") {
                            romajiBuilder += "iu";
                            processed = true;
                        } else if (charStr === "Я") {
                            romajiBuilder += "Ia";
                            processed = true;
                        } else if (charStr === "я") {
                            romajiBuilder += "ia";
                            processed = true;
                        }
                    }

                    if (!processed) {
                        romajiBuilder += this.UKRAINIAN_ROMAJI_MAP[charStr] || this.GENERAL_CYRILLIC_ROMAJI_MAP[charStr] || charStr;
                    }
                    charIndex++;
                }
            }
        }
        return romajiBuilder;
    }

    private static romanizeSerbianInternal(text: string): string {
        let romajiBuilder = "";
        const words = text.split(/((?=\s|[.,!?;])|(?<=\s|[.,!?;]))/g).filter(Boolean);

        for (const word of words) {
            if (/^[.,!?;]$/.test(word) || !word.trim()) {
                romajiBuilder += word;
            } else {
                let charIndex = 0;
                while (charIndex < word.length) {
                    const charStr = word[charIndex];
                    const romanizedChar = this.SERBIAN_ROMAJI_MAP[charStr] || this.GENERAL_CYRILLIC_ROMAJI_MAP[charStr] || charStr;
                    romajiBuilder += romanizedChar;
                    charIndex++;
                }
            }
        }
        return romajiBuilder;
    }

    private static romanizeBulgarianInternal(text: string): string {
        let romajiBuilder = "";
        const words = text.split(/((?=\s|[.,!?;])|(?<=\s|[.,!?;]))/g).filter(Boolean);

        for (const word of words) {
            if (/^[.,!?;]$/.test(word) || !word.trim()) {
                romajiBuilder += word;
            } else {
                let charIndex = 0;
                while (charIndex < word.length) {
                    const charStr = word[charIndex];
                    const romanizedChar = this.BULGARIAN_ROMAJI_MAP[charStr] || this.GENERAL_CYRILLIC_ROMAJI_MAP[charStr] || charStr;
                    romajiBuilder += romanizedChar;
                    charIndex++;
                }
            }
        }
        return romajiBuilder;
    }

    private static romanizeBelarusianInternal(text: string): string {
        let romajiBuilder = "";
        const words = text.split(/((?=\s|[.,!?;])|(?<=\s|[.,!?;]))/g).filter(Boolean);

        for (const word of words) {
            if (/^[.,!?;]$/.test(word) || !word.trim()) {
                romajiBuilder += word;
            } else {
                let charIndex = 0;
                while (charIndex < word.length) {
                    const charStr = word[charIndex];
                    
                    if ((charStr === "е" || charStr === "Е") && (charIndex === 0 || /\s/.test(word[charIndex - 1] || ""))) {
                        romajiBuilder += charStr === "е" ? "ye" : "Ye";
                    } else {
                        const romanizedChar = this.BELARUSIAN_ROMAJI_MAP[charStr] || this.GENERAL_CYRILLIC_ROMAJI_MAP[charStr] || charStr;
                        romajiBuilder += romanizedChar;
                    }
                    charIndex += 1;
                }
            }
        }
        return romajiBuilder;
    }

    private static romanizeKyrgyzInternal(text: string): string {
        let romajiBuilder = "";
        const words = text.split(/((?=\s|[.,!?;])|(?<=\s|[.,!?;]))/g).filter(Boolean);

        for (const word of words) {
            if (/^[.,!?;]$/.test(word) || !word.trim()) {
                romajiBuilder += word;
            } else {
                let charIndex = 0;
                while (charIndex < word.length) {
                    const charStr = word[charIndex];
                    const romanizedChar = this.KYRGYZ_ROMAJI_MAP[charStr] || this.GENERAL_CYRILLIC_ROMAJI_MAP[charStr] || charStr;
                    romajiBuilder += romanizedChar;
                    charIndex++;
                }
            }
        }
        return romajiBuilder;
    }

    private static romanizeMacedonianInternal(text: string): string {
        let romajiBuilder = "";
        const words = text.split(/((?=\s|[.,!?;])|(?<=\s|[.,!?;]))/g).filter(Boolean);

        for (const word of words) {
            if (/^[.,!?;]$/.test(word) || !word.trim()) {
                romajiBuilder += word;
            } else {
                let charIndex = 0;
                while (charIndex < word.length) {
                    const charStr = word[charIndex];
                    const romanizedChar = this.MACEDONIAN_ROMAJI_MAP[charStr] || this.GENERAL_CYRILLIC_ROMAJI_MAP[charStr] || charStr;
                    romajiBuilder += romanizedChar;
                    charIndex++;
                }
            }
        }
        return romajiBuilder;
    }

    public static async romanizeCyrillic(text: string): Promise<string | null> {
        if (!text) return null;

        const cyrillicChars = [...text].filter(char => /[\u0400-\u04FF]/.test(char));

        if (cyrillicChars.length === 0 ||
            (cyrillicChars.length === 1 && (cyrillicChars[0] === 'е' || cyrillicChars[0] === 'Е'))) {
            return null;
        }

        if (this.isRussian(text)) {
            return this.romanizeRussianInternal(text);
        } else if (this.isUkrainian(text)) {
            return this.romanizeUkrainianInternal(text);
        } else if (this.isSerbian(text)) {
            return this.romanizeSerbianInternal(text);
        } else if (this.isBulgarian(text)) {
            return this.romanizeBulgarianInternal(text);
        } else if (this.isBelarusian(text)) {
            return this.romanizeBelarusianInternal(text);
        } else if (this.isKyrgyz(text)) {
            return this.romanizeKyrgyzInternal(text);
        } else if (this.isMacedonian(text)) {
            return this.romanizeMacedonianInternal(text);
        }
        
        return null;
    }


    public static async romanizeHindi(text: string): Promise<string> {
        let sb = "";
        let i = 0;
        while (i < text.length) {
            let consumed = false;
            
            if (i + 1 < text.length) {
                const twoCharCandidate = text.substring(i, i + 2);
                const mappedTwoChar = this.DEVANAGARI_ROMAJI_MAP[twoCharCandidate];
                if (mappedTwoChar) {
                    sb += mappedTwoChar;
                    i += 2;
                    consumed = true;
                }
            }

            if (!consumed) {
                const charStr = text[i];
                sb += this.DEVANAGARI_ROMAJI_MAP[charStr] || charStr;
                i += 1;
            }
        }
        return sb;
    }

    public static async romanizePunjabi(text: string): Promise<string> {
        let sb = "";
        let i = 0;
        while (i < text.length) {
            const char = text[i];
            let consumed = false;

            if (char === '\u0A71') {
                 if (i + 1 < text.length) {
                     const nextCharStr = text[i+1];
                     const nextMapped = this.GURMUKHI_ROMAJI_MAP[nextCharStr];
                     if (nextMapped && nextMapped.length > 0) {
                         sb += nextMapped[0];
                     }
                 }
                 i++;
                 continue;
            }

            if (i + 1 < text.length) {
                const twoCharCandidate = text.substring(i, i + 2);
                const mappedTwoChar = this.GURMUKHI_ROMAJI_MAP[twoCharCandidate];
                if (mappedTwoChar) {
                    sb += mappedTwoChar;
                    i += 2;
                    consumed = true;
                }
            }

            if (!consumed) {
                const str = char;
                sb += this.GURMUKHI_ROMAJI_MAP[str] || str;
                i++;
            }
        }
        return sb;
    }

    public static isJapanese(text: string): boolean {
        return /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/.test(text);
    }

    public static isKorean(text: string): boolean {
        return /[\uAC00-\uD7A3]/.test(text);
    }

    public static isChinese(text: string): boolean {
        if (!text) return false;
        const cjkMatch = text.match(/[\u4E00-\u9FFF]/g);
        const cjkCount = cjkMatch ? cjkMatch.length : 0;
        const kanaMatch = text.match(/[\u3040-\u309F\u30A0-\u30FF]/g);
        const kanaCount = kanaMatch ? kanaMatch.length : 0;
        
        return cjkCount > 0 && (kanaCount / text.length) < 0.1;
    }

    public static isHindi(text: string): boolean {
        return /[\u0900-\u097F]/.test(text);
    }

    public static isPunjabi(text: string): boolean {
        return /[\u0A00-\u0A7F]/.test(text);
    }
    

    public static isRussian(text: string): boolean {
        const hasRussian = [...text].some(char => this.RUSSIAN_CYRILLIC_LETTERS.has(char));
        const allValid = [...text].every(char => this.RUSSIAN_CYRILLIC_LETTERS.has(char) || !/[\u0400-\u04FF]/.test(char));
        return hasRussian && allValid;
    }

    public static isUkrainian(text: string): boolean {
        const hasUkrainian = [...text].some(char => this.UKRAINIAN_CYRILLIC_LETTERS.has(char) || this.UKRAINIAN_SPECIFIC_CYRILLIC_LETTERS.has(char));
        const allValid = [...text].every(char => this.UKRAINIAN_CYRILLIC_LETTERS.has(char) || this.UKRAINIAN_SPECIFIC_CYRILLIC_LETTERS.has(char) || !/[\u0400-\u04FF]/.test(char));
        return hasUkrainian && allValid;
    }

    public static isSerbian(text: string): boolean {
        const hasSerbian = [...text].some(char => this.SERBIAN_CYRILLIC_LETTERS.has(char) || this.SERBIAN_SPECIFIC_CYRILLIC_LETTERS.has(char));
        const allValid = [...text].every(char => this.SERBIAN_CYRILLIC_LETTERS.has(char) || this.SERBIAN_SPECIFIC_CYRILLIC_LETTERS.has(char) || !/[\u0400-\u04FF]/.test(char));
        return hasSerbian && allValid;
    }

    public static isBulgarian(text: string): boolean {
        const hasBulgarian = [...text].some(char => this.BULGARIAN_CYRILLIC_LETTERS.has(char));
        const allValid = [...text].every(char => this.BULGARIAN_CYRILLIC_LETTERS.has(char) || !/[\u0400-\u04FF]/.test(char));
        return hasBulgarian && allValid;
    }

    public static isBelarusian(text: string): boolean {
        const hasBelarusian = [...text].some(char => this.BELARUSIAN_CYRILLIC_LETTERS.has(char) || this.BELARUSIAN_SPECIFIC_CYRILLIC_LETTERS.has(char));
        const allValid = [...text].every(char => this.BELARUSIAN_CYRILLIC_LETTERS.has(char) || this.BELARUSIAN_SPECIFIC_CYRILLIC_LETTERS.has(char) || !/[\u0400-\u04FF]/.test(char));
        return hasBelarusian && allValid;
    }

    public static isKyrgyz(text: string): boolean {
        const hasKyrgyz = [...text].some(char => this.KYRGYZ_CYRILLIC_LETTERS.has(char) || this.KYRGYZ_SPECIFIC_CYRILLIC_LETTERS.has(char));
        const allValid = [...text].every(char => this.KYRGYZ_CYRILLIC_LETTERS.has(char) || this.KYRGYZ_SPECIFIC_CYRILLIC_LETTERS.has(char) || !/[\u0400-\u04FF]/.test(char));
        return hasKyrgyz && allValid;
    }

    public static isMacedonian(text: string): boolean {
        const hasMacedonian = [...text].some(char => this.MACEDONIAN_CYRILLIC_LETTERS.has(char) || this.MACEDONIAN_SPECIFIC_CYRILLIC_LETTERS.has(char));
        const allValid = [...text].every(char => this.MACEDONIAN_CYRILLIC_LETTERS.has(char) || this.MACEDONIAN_SPECIFIC_CYRILLIC_LETTERS.has(char) || !/[\u0400-\u04FF]/.test(char));
        return hasMacedonian && allValid;
    }

    public static isCyrillic(text: string): boolean {
        return /[\u0400-\u04FF]/.test(text);
    }

    public static async romanize(text: string): Promise<string> {
        if (!text) return "";
        
        if (this.isChinese(text)) {
            // Note: Chinese check needs to come before Japanese since kanji share characters
            return await this.romanizeChinese(text);
        } else if (this.isJapanese(text)) {
            return await this.romanizeJapanese(text);
        } else if (this.isKorean(text)) {
            return await this.romanizeKorean(text);
        } else if (this.isHindi(text)) {
            return await this.romanizeHindi(text);
        } else if (this.isPunjabi(text)) {
            return await this.romanizePunjabi(text);
        } else if (this.isCyrillic(text)) {
            const res = await this.romanizeCyrillic(text);
            return res || text;
        }
        return text;
    }
}
