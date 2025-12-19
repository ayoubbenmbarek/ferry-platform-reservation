/**
 * Voice Search Natural Language Parser
 * Parses spoken queries into ferry search parameters
 */

export interface ParsedSearchQuery {
  departurePort: string | null;
  arrivalPort: string | null;
  departureDate: string | null;
  returnDate: string | null;
  isRoundTrip: boolean;
  adults: number;
  children: number;
  infants: number;
  hasVehicle: boolean;
  confidence: number;
  rawText: string;
}

// Port name aliases in multiple languages
// IMPORTANT: Only include ports that exist in frontend/src/types/ferry.ts PORTS array
const PORT_ALIASES: Record<string, string[]> = {
  // Tunisia (FerryHopper supported ports only)
  'tunis': ['tunis', 'تونس', 'tunisie', 'tunisia', 'la goulette', 'goulette', 'tunus'],
  'zarzis': ['zarzis', 'جرجيس', 'djerba'],

  // Italy (available ports only)
  'genoa': ['genoa', 'genova', 'gênes', 'genes', 'جنوة', 'genua'],
  'civitavecchia': ['civitavecchia', 'rome', 'roma', 'روما', 'civita'],
  'palermo': ['palermo', 'باليرمو'],
  'salerno': ['salerno', 'ساليرنو'],
  'trapani': ['trapani', 'طرابني'],

  // France (all available ports)
  'marseille': ['marseille', 'مرسيليا', 'marsiglia', 'marseilles'],
  'nice': ['nice', 'نيس'],
  'toulon': ['toulon', 'طولون'],
};

// Round trip keywords in multiple languages
const ROUND_TRIP_KEYWORDS = {
  en: ['round trip', 'roundtrip', 'return', 'both ways', 'there and back', 'round-trip'],
  fr: ['aller-retour', 'aller retour', 'allerretour', 'avec retour'],
  ar: ['ذهاب وعودة', 'رحلة ذهاب وإياب', 'ذهاب وإياب'],
};

// One-way keywords
const ONE_WAY_KEYWORDS = {
  en: ['one way', 'one-way', 'single', 'only going'],
  fr: ['aller simple', 'simple'],
  ar: ['ذهاب فقط', 'اتجاه واحد'],
};

// Direction keywords
const FROM_KEYWORDS = {
  en: ['from', 'departing from', 'leaving from', 'starting from'],
  fr: ['de', 'depuis', 'au départ de', 'partant de'],
  ar: ['من', 'انطلاقا من'],
};

const TO_KEYWORDS = {
  en: ['to', 'going to', 'arriving at', 'destination'],
  fr: ['à', 'vers', 'pour', 'destination'],
  ar: ['إلى', 'الى', 'وجهة'],
};

const RETURN_DATE_KEYWORDS = {
  en: ['returning', 'return on', 'back on', 'coming back'],
  fr: ['retour le', 'retour', 'revenir le'],
  ar: ['العودة', 'الرجوع'],
};

// Relative date patterns
const DATE_PATTERNS = {
  en: {
    today: ['today', 'tonight'],
    tomorrow: ['tomorrow'],
    dayAfterTomorrow: ['day after tomorrow', 'in 2 days'],
    nextWeek: ['next week'],
    thisWeekend: ['this weekend', 'weekend'],
    // Days of week
    monday: ['monday', 'mon'],
    tuesday: ['tuesday', 'tue', 'tues'],
    wednesday: ['wednesday', 'wed'],
    thursday: ['thursday', 'thu', 'thurs'],
    friday: ['friday', 'fri'],
    saturday: ['saturday', 'sat'],
    sunday: ['sunday', 'sun'],
  },
  fr: {
    today: ["aujourd'hui", 'ce soir'],
    tomorrow: ['demain'],
    dayAfterTomorrow: ['après-demain', 'après demain'],
    nextWeek: ['la semaine prochaine', 'semaine prochaine'],
    thisWeekend: ['ce weekend', 'ce week-end'],
    monday: ['lundi'],
    tuesday: ['mardi'],
    wednesday: ['mercredi'],
    thursday: ['jeudi'],
    friday: ['vendredi'],
    saturday: ['samedi'],
    sunday: ['dimanche'],
  },
  ar: {
    today: ['اليوم'],
    tomorrow: ['غدا', 'غداً'],
    dayAfterTomorrow: ['بعد غد'],
    nextWeek: ['الأسبوع القادم', 'الاسبوع المقبل'],
    thisWeekend: ['نهاية الأسبوع'],
    monday: ['الاثنين'],
    tuesday: ['الثلاثاء'],
    wednesday: ['الأربعاء'],
    thursday: ['الخميس'],
    friday: ['الجمعة'],
    saturday: ['السبت'],
    sunday: ['الأحد'],
  },
};

// Passenger keywords
const PASSENGER_PATTERNS = {
  en: {
    adults: ['adult', 'adults', 'person', 'people', 'passenger', 'passengers'],
    children: ['child', 'children', 'kid', 'kids'],
    infants: ['infant', 'infants', 'baby', 'babies'],
  },
  fr: {
    adults: ['adulte', 'adultes', 'personne', 'personnes', 'passager', 'passagers'],
    children: ['enfant', 'enfants'],
    infants: ['bébé', 'bébés', 'nourrisson', 'nourrissons'],
  },
  ar: {
    adults: ['بالغ', 'بالغين', 'شخص', 'أشخاص'],
    children: ['طفل', 'أطفال'],
    infants: ['رضيع', 'رضع'],
  },
};

// Vehicle keywords
const VEHICLE_KEYWORDS = {
  en: ['vehicle', 'car', 'van', 'motorcycle', 'motorbike', 'camper', 'motorhome', 'trailer', 'bike', 'automobile'],
  fr: ['véhicule', 'vehicule', 'voiture', 'moto', 'camping-car', 'camion', 'camionnette', 'remorque'],
  ar: ['سيارة', 'مركبة', 'دراجة نارية'],
};

/**
 * Parse a voice search query into structured search parameters
 */
export function parseVoiceSearch(text: string, language: string = 'en'): ParsedSearchQuery {
  const normalizedText = text.toLowerCase().trim();
  const lang = language.split('-')[0] as 'en' | 'fr' | 'ar';

  const result: ParsedSearchQuery = {
    departurePort: null,
    arrivalPort: null,
    departureDate: null,
    returnDate: null,
    isRoundTrip: false,
    adults: 1,
    children: 0,
    infants: 0,
    hasVehicle: false,
    confidence: 0,
    rawText: text,
  };

  let confidenceScore = 0;

  // Detect round trip or one-way
  const allRoundTripKeywords = [
    ...ROUND_TRIP_KEYWORDS.en,
    ...ROUND_TRIP_KEYWORDS.fr,
    ...ROUND_TRIP_KEYWORDS.ar,
  ];
  const allOneWayKeywords = [
    ...ONE_WAY_KEYWORDS.en,
    ...ONE_WAY_KEYWORDS.fr,
    ...ONE_WAY_KEYWORDS.ar,
  ];

  if (allRoundTripKeywords.some(kw => normalizedText.includes(kw))) {
    result.isRoundTrip = true;
    confidenceScore += 10;
  } else if (allOneWayKeywords.some(kw => normalizedText.includes(kw))) {
    result.isRoundTrip = false;
    confidenceScore += 10;
  }

  // Extract ports
  const ports = extractPorts(normalizedText, lang);
  if (ports.departure) {
    result.departurePort = ports.departure;
    confidenceScore += 30;
  }
  if (ports.arrival) {
    result.arrivalPort = ports.arrival;
    confidenceScore += 30;
  }

  // Extract dates
  const dates = extractDates(normalizedText, lang);
  if (dates.departure) {
    result.departureDate = dates.departure;
    confidenceScore += 15;
  }
  if (dates.return) {
    result.returnDate = dates.return;
    result.isRoundTrip = true;
    confidenceScore += 15;
  }

  // Extract passengers
  const passengers = extractPassengers(normalizedText, lang);
  result.adults = passengers.adults;
  result.children = passengers.children;
  result.infants = passengers.infants;

  // Detect vehicle
  const allVehicleKeywords = [
    ...VEHICLE_KEYWORDS.en,
    ...VEHICLE_KEYWORDS.fr,
    ...VEHICLE_KEYWORDS.ar,
  ];

  if (allVehicleKeywords.some(kw => normalizedText.includes(kw))) {
    result.hasVehicle = true;
    confidenceScore += 5;
  }

  // Calculate final confidence
  result.confidence = Math.min(confidenceScore, 100);

  return result;
}

/**
 * Extract departure and arrival ports from text
 */
function extractPorts(text: string, _lang: 'en' | 'fr' | 'ar'): { departure: string | null; arrival: string | null } {
  let departure: string | null = null;
  let arrival: string | null = null;

  // Build regex patterns for from/to
  const fromPatterns = [...FROM_KEYWORDS.en, ...FROM_KEYWORDS.fr, ...FROM_KEYWORDS.ar];
  const toPatterns = [...TO_KEYWORDS.en, ...TO_KEYWORDS.fr, ...TO_KEYWORDS.ar];

  // Find all port mentions in order
  const portMentions: Array<{ port: string; index: number }> = [];

  for (const [portCode, aliases] of Object.entries(PORT_ALIASES)) {
    for (const alias of aliases) {
      const index = text.indexOf(alias);
      if (index !== -1) {
        portMentions.push({ port: portCode, index });
        break; // Only count each port once
      }
    }
  }

  // Sort by position in text
  portMentions.sort((a, b) => a.index - b.index);

  if (portMentions.length >= 2) {
    // Check for "from X to Y" pattern
    for (const fromKw of fromPatterns) {
      const fromIndex = text.indexOf(fromKw);
      if (fromIndex !== -1) {
        // Find port after "from"
        const portAfterFrom = portMentions.find(p => p.index > fromIndex);
        if (portAfterFrom) {
          departure = portAfterFrom.port;
        }
      }
    }

    for (const toKw of toPatterns) {
      const toIndex = text.indexOf(toKw);
      if (toIndex !== -1) {
        // Find port after "to"
        const portAfterTo = portMentions.find(p => p.index > toIndex);
        if (portAfterTo && portAfterTo.port !== departure) {
          arrival = portAfterTo.port;
        }
      }
    }

    // If still not found, assume first is departure, second is arrival
    if (!departure && !arrival) {
      departure = portMentions[0].port;
      arrival = portMentions[1].port;
    } else if (!arrival && departure) {
      // Find a port that isn't the departure
      const otherPort = portMentions.find(p => p.port !== departure);
      if (otherPort) {
        arrival = otherPort.port;
      }
    } else if (!departure && arrival) {
      // Find a port that isn't the arrival
      const otherPort = portMentions.find(p => p.port !== arrival);
      if (otherPort) {
        departure = otherPort.port;
      }
    }
  } else if (portMentions.length === 1) {
    // Only one port mentioned - try to determine if it's departure or arrival
    const port = portMentions[0];

    const hasFromBefore = fromPatterns.some(kw => {
      const idx = text.indexOf(kw);
      return idx !== -1 && idx < port.index;
    });

    const hasToBefore = toPatterns.some(kw => {
      const idx = text.indexOf(kw);
      return idx !== -1 && idx < port.index;
    });

    if (hasFromBefore) {
      departure = port.port;
    } else if (hasToBefore) {
      arrival = port.port;
    }
  }

  return { departure, arrival };
}

/**
 * Extract dates from text
 */
function extractDates(text: string, lang: 'en' | 'fr' | 'ar'): { departure: string | null; return: string | null } {
  const today = new Date();
  let departureDate: string | null = null;
  let returnDate: string | null = null;

  const patterns = DATE_PATTERNS[lang] || DATE_PATTERNS.en;
  const returnKeywords = [...RETURN_DATE_KEYWORDS.en, ...RETURN_DATE_KEYWORDS.fr, ...RETURN_DATE_KEYWORDS.ar];

  // Check for return date marker
  let returnMarkerIndex = -1;
  for (const kw of returnKeywords) {
    const idx = text.indexOf(kw);
    if (idx !== -1) {
      returnMarkerIndex = idx;
      break;
    }
  }

  // Helper to format date (use local timezone to avoid UTC offset issues)
  const formatDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Helper to get next occurrence of a day
  const getNextDay = (dayIndex: number): Date => {
    const date = new Date(today);
    const currentDay = date.getDay();
    const daysUntil = (dayIndex - currentDay + 7) % 7 || 7;
    date.setDate(date.getDate() + daysUntil);
    return date;
  };

  // Map day names to day indices
  const dayMap: Record<string, number> = {
    sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
    thursday: 4, friday: 5, saturday: 6,
  };

  // Find all date mentions
  const dateMentions: Array<{ date: Date; index: number }> = [];

  // Check each pattern
  for (const [key, keywords] of Object.entries(patterns)) {
    for (const keyword of keywords as string[]) {
      const index = text.indexOf(keyword);
      if (index !== -1) {
        let date: Date;

        switch (key) {
          case 'today':
            date = new Date(today);
            break;
          case 'tomorrow':
            date = new Date(today);
            date.setDate(date.getDate() + 1);
            break;
          case 'dayAfterTomorrow':
            date = new Date(today);
            date.setDate(date.getDate() + 2);
            break;
          case 'nextWeek':
            date = new Date(today);
            date.setDate(date.getDate() + 7);
            break;
          case 'thisWeekend':
            date = getNextDay(6); // Saturday
            break;
          default:
            // It's a day of week
            const dayIndex = dayMap[key];
            if (dayIndex !== undefined) {
              date = getNextDay(dayIndex);
            } else {
              continue;
            }
        }

        dateMentions.push({ date, index });
        break;
      }
    }
  }

  // Month names mapping
  const monthNames: Record<string, number> = {
    january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
    july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
    janvier: 0, février: 1, fevrier: 1, mars: 2, avril: 3, mai: 4, juin: 5,
    juillet: 6, août: 7, aout: 7, septembre: 8, octobre: 9, novembre: 10, décembre: 11, decembre: 11,
  };

  // Pattern 1: American format "Month Day" (e.g., "July 25", "August 15th")
  const monthDayPattern = /(january|february|march|april|may|june|july|august|september|october|november|december|janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre)\s+(\d{1,2})(?:st|nd|rd|th)?/gi;

  let match;
  while ((match = monthDayPattern.exec(text)) !== null) {
    const month = monthNames[match[1].toLowerCase()];
    const day = parseInt(match[2]);

    const date = new Date(today.getFullYear(), month, day);
    if (date < today) {
      date.setFullYear(date.getFullYear() + 1);
    }

    dateMentions.push({ date, index: match.index });
  }

  // Pattern 2: European format "Day Month" (e.g., "25 July", "15 août")
  const dayMonthPattern = /(\d{1,2})(?:\s*(?:st|nd|rd|th)?)?(?:\s+(?:of\s+)?)?(january|february|march|april|may|june|july|august|september|october|november|december|janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre)/gi;

  while ((match = dayMonthPattern.exec(text)) !== null) {
    const day = parseInt(match[1]);
    const month = monthNames[match[2].toLowerCase()];

    const date = new Date(today.getFullYear(), month, day);
    if (date < today) {
      date.setFullYear(date.getFullYear() + 1);
    }

    dateMentions.push({ date, index: match.index });
  }

  // Pattern 3: Month only (e.g., "August", "juillet") - use first day of month
  const monthOnlyPattern = /\b(january|february|march|april|may|june|july|august|september|october|november|december|janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre)\b/gi;

  let monthMatch: RegExpExecArray | null;
  while ((monthMatch = monthOnlyPattern.exec(text)) !== null) {
    // Capture values to avoid ESLint warning about loop variables
    const monthName = monthMatch[1].toLowerCase();
    const matchIndex = monthMatch.index;

    // Skip if this month is already part of a full date (check if already matched)
    const alreadyMatched = dateMentions.some(dm =>
      Math.abs(dm.index - matchIndex) < 30
    );

    if (!alreadyMatched) {
      const month = monthNames[monthName];
      const day = 1; // Default to first day of month

      const date = new Date(today.getFullYear(), month, day);
      if (date < today) {
        date.setFullYear(date.getFullYear() + 1);
      }

      dateMentions.push({ date, index: matchIndex });
    }
  }

  // Sort by position
  dateMentions.sort((a, b) => a.index - b.index);

  // Assign dates based on position relative to return marker
  if (dateMentions.length >= 2) {
    if (returnMarkerIndex !== -1) {
      // Dates before return marker are departure, after are return
      for (const mention of dateMentions) {
        if (mention.index < returnMarkerIndex) {
          departureDate = formatDate(mention.date);
        } else {
          returnDate = formatDate(mention.date);
        }
      }
    } else {
      // First is departure, second is return
      departureDate = formatDate(dateMentions[0].date);
      returnDate = formatDate(dateMentions[1].date);
    }
  } else if (dateMentions.length === 1) {
    if (returnMarkerIndex !== -1 && dateMentions[0].index > returnMarkerIndex) {
      returnDate = formatDate(dateMentions[0].date);
    } else {
      departureDate = formatDate(dateMentions[0].date);
    }
  }

  return { departure: departureDate, return: returnDate };
}

/**
 * Extract passenger counts from text
 */
function extractPassengers(text: string, lang: 'en' | 'fr' | 'ar'): { adults: number; children: number; infants: number } {
  const result = { adults: 1, children: 0, infants: 0 };

  const patterns = PASSENGER_PATTERNS[lang] || PASSENGER_PATTERNS.en;

  // Number words mapping for multiple languages
  const numberWords: Record<string, number> = {
    // English
    'a': 1, 'an': 1, 'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
    'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
    // French (note: 'six' is same in French and English)
    'un': 1, 'une': 1, 'deux': 2, 'trois': 3, 'quatre': 4, 'cinq': 5,
    'sept': 7, 'huit': 8, 'neuf': 9, 'dix': 10,
    // Arabic (written in Latin script for transcription)
    'wahid': 1, 'ithnain': 2, 'thalatha': 3, 'arbaa': 4, 'khamsa': 5,
  };

  // Helper to extract number from text (digit or word)
  const extractNumber = (match: string): number | null => {
    // Try to parse as digit first
    const digit = parseInt(match);
    if (!isNaN(digit)) return digit;

    // Try to match as word
    const word = match.toLowerCase().trim();
    return numberWords[word] || null;
  };

  // Pattern to find numbers (digits or words) followed by passenger type
  // e.g., "2 adults", "two people", "a child", "3 enfants", "trois personnes"
  for (const [type, keywords] of Object.entries(patterns)) {
    for (const keyword of keywords as string[]) {
      // Check for "X keyword" pattern (where X is digit, word, or article)
      const regex = new RegExp(`(\\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten|un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix)\\s+${keyword}`, 'i');
      const match = text.match(regex);
      if (match) {
        const count = extractNumber(match[1]);
        if (count !== null) {
          if (type === 'adults') result.adults = count;
          else if (type === 'children') result.children = count;
          else if (type === 'infants') result.infants = count;
          break;
        }
      }
    }
  }

  return result;
}

/**
 * Get user-friendly display text for parsed query
 */
export function getQuerySummary(parsed: ParsedSearchQuery, _language: string = 'en'): string {
  const parts: string[] = [];

  if (parsed.departurePort && parsed.arrivalPort) {
    parts.push(`${parsed.departurePort.toUpperCase()} → ${parsed.arrivalPort.toUpperCase()}`);
  } else if (parsed.departurePort) {
    parts.push(`From ${parsed.departurePort.toUpperCase()}`);
  } else if (parsed.arrivalPort) {
    parts.push(`To ${parsed.arrivalPort.toUpperCase()}`);
  }

  if (parsed.departureDate) {
    parts.push(new Date(parsed.departureDate).toLocaleDateString());
  }

  if (parsed.isRoundTrip && parsed.returnDate) {
    parts.push(`↔ ${new Date(parsed.returnDate).toLocaleDateString()}`);
  } else if (parsed.isRoundTrip) {
    parts.push('(Round trip)');
  }

  const passengerCount = parsed.adults + parsed.children + parsed.infants;
  if (passengerCount > 1) {
    parts.push(`${passengerCount} passengers`);
  }

  return parts.join(' • ') || 'No search parameters detected';
}
