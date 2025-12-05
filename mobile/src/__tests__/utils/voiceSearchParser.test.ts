/**
 * Voice Search Parser Tests
 *
 * Tests the natural language parsing functionality for voice search
 */

import { parseVoiceSearch, getQuerySummary, ParsedSearchQuery } from '../../utils/voiceSearchParser';

describe('Voice Search Parser', () => {
  describe('parseVoiceSearch', () => {
    describe('Basic parsing', () => {
      it('should return default values for empty text', () => {
        const result = parseVoiceSearch('');

        expect(result.departurePort).toBeNull();
        expect(result.arrivalPort).toBeNull();
        expect(result.departureDate).toBeNull();
        expect(result.returnDate).toBeNull();
        expect(result.isRoundTrip).toBe(false);
        expect(result.adults).toBe(1);
        expect(result.children).toBe(0);
        expect(result.infants).toBe(0);
        expect(result.hasVehicle).toBe(false);
        expect(result.rawText).toBe('');
      });

      it('should preserve raw text', () => {
        const text = 'Ferry from Tunis to Marseille';
        const result = parseVoiceSearch(text);
        expect(result.rawText).toBe(text);
      });
    });

    describe('Port extraction', () => {
      it('should extract departure port from "from Tunis"', () => {
        const result = parseVoiceSearch('Ferry from Tunis');
        expect(result.departurePort).toBe('tunis');
      });

      it('should extract arrival port from "to Marseille"', () => {
        const result = parseVoiceSearch('Ferry to Marseille');
        expect(result.arrivalPort).toBe('marseille');
      });

      it('should extract both ports from "from Tunis to Marseille"', () => {
        const result = parseVoiceSearch('Ferry from Tunis to Marseille');
        expect(result.departurePort).toBe('tunis');
        expect(result.arrivalPort).toBe('marseille');
      });

      it('should handle port aliases - Genova for Genoa', () => {
        const result = parseVoiceSearch('From Genova to Tunis');
        expect(result.departurePort).toBe('genoa');
      });

      it('should handle port aliases - La Goulette for Tunis', () => {
        const result = parseVoiceSearch('Ferry to La Goulette');
        expect(result.arrivalPort).toBe('tunis');
      });

      it('should handle French port names', () => {
        const result = parseVoiceSearch('de Tunis à Gênes', 'fr');
        expect(result.departurePort).toBe('tunis');
        expect(result.arrivalPort).toBe('genoa');
      });

      it('should detect Rome/Civitavecchia', () => {
        const result = parseVoiceSearch('Ferry to Rome');
        expect(result.arrivalPort).toBe('civitavecchia');
      });

      it('should handle two ports without from/to keywords', () => {
        const result = parseVoiceSearch('Tunis Marseille ferry');
        expect(result.departurePort).toBe('tunis');
        expect(result.arrivalPort).toBe('marseille');
      });
    });

    describe('Round trip detection', () => {
      it('should detect round trip keyword', () => {
        const result = parseVoiceSearch('Round trip from Tunis to Marseille');
        expect(result.isRoundTrip).toBe(true);
      });

      it('should detect "return" keyword as round trip', () => {
        const result = parseVoiceSearch('Tunis to Marseille with return');
        expect(result.isRoundTrip).toBe(true);
      });

      it('should detect French aller-retour', () => {
        const result = parseVoiceSearch('Aller-retour Tunis Marseille', 'fr');
        expect(result.isRoundTrip).toBe(true);
      });

      it('should detect one-way keyword', () => {
        const result = parseVoiceSearch('One way ticket from Tunis to Genoa');
        expect(result.isRoundTrip).toBe(false);
      });

      it('should detect French aller simple', () => {
        const result = parseVoiceSearch('Aller simple vers Marseille', 'fr');
        expect(result.isRoundTrip).toBe(false);
      });
    });

    describe('Date extraction', () => {
      beforeEach(() => {
        // Mock the current date for consistent testing
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2025-06-15'));
      });

      afterEach(() => {
        jest.useRealTimers();
      });

      it('should parse "today"', () => {
        const result = parseVoiceSearch('Ferry from Tunis today');
        expect(result.departureDate).toBe('2025-06-15');
      });

      it('should parse "tomorrow"', () => {
        const result = parseVoiceSearch('Ferry tomorrow to Marseille');
        expect(result.departureDate).toBe('2025-06-16');
      });

      it('should parse "day after tomorrow"', () => {
        const result = parseVoiceSearch('Book for day after tomorrow');
        expect(result.departureDate).toBe('2025-06-17');
      });

      it('should parse "next week"', () => {
        const result = parseVoiceSearch('Travel next week');
        expect(result.departureDate).toBe('2025-06-22');
      });

      it('should parse French "demain"', () => {
        const result = parseVoiceSearch('Ferry demain', 'fr');
        expect(result.departureDate).toBe('2025-06-16');
      });

      it('should parse day names like "Monday"', () => {
        const result = parseVoiceSearch('Ferry on Monday');
        // June 15, 2025 is a Sunday, so Monday is June 16
        expect(result.departureDate).toBe('2025-06-16');
      });

      it('should parse "July 25" format', () => {
        const result = parseVoiceSearch('Ferry on July 25');
        expect(result.departureDate).toBe('2025-07-25');
      });

      it('should parse "25 July" format', () => {
        const result = parseVoiceSearch('Book for 25 July');
        expect(result.departureDate).toBe('2025-07-25');
      });

      it('should parse two dates as departure and return', () => {
        const result = parseVoiceSearch('From July 15 to July 22');
        expect(result.departureDate).toBe('2025-07-15');
        expect(result.returnDate).toBe('2025-07-22');
        expect(result.isRoundTrip).toBe(true);
      });

      it('should handle return date keyword', () => {
        const result = parseVoiceSearch('Departing tomorrow returning Friday');
        expect(result.departureDate).toBe('2025-06-16');
        expect(result.returnDate).toBe('2025-06-20');
      });
    });

    describe('Passenger extraction', () => {
      it('should parse "2 adults"', () => {
        const result = parseVoiceSearch('Book for 2 adults');
        expect(result.adults).toBe(2);
      });

      it('should parse "3 adults and 2 children"', () => {
        const result = parseVoiceSearch('3 adults and 2 children');
        expect(result.adults).toBe(3);
        expect(result.children).toBe(2);
      });

      it('should parse "1 adult 2 kids 1 infant"', () => {
        const result = parseVoiceSearch('1 adult 2 kids 1 infant');
        expect(result.adults).toBe(1);
        expect(result.children).toBe(2);
        expect(result.infants).toBe(1);
      });

      it('should parse word numbers like "two passengers"', () => {
        const result = parseVoiceSearch('Two passengers');
        expect(result.adults).toBe(2);
      });

      it('should parse French "deux adultes"', () => {
        const result = parseVoiceSearch('Pour deux adultes', 'fr');
        expect(result.adults).toBe(2);
      });

      it('should default to 1 adult if no passengers specified', () => {
        const result = parseVoiceSearch('Ferry to Marseille');
        expect(result.adults).toBe(1);
      });

      it('should parse "five people"', () => {
        const result = parseVoiceSearch('Book for five people');
        expect(result.adults).toBe(5);
      });
    });

    describe('Vehicle detection', () => {
      it('should detect "car"', () => {
        const result = parseVoiceSearch('Ferry with car');
        expect(result.hasVehicle).toBe(true);
      });

      it('should detect "vehicle"', () => {
        const result = parseVoiceSearch('Booking with vehicle');
        expect(result.hasVehicle).toBe(true);
      });

      it('should detect "motorcycle"', () => {
        const result = parseVoiceSearch('Ferry with motorcycle');
        expect(result.hasVehicle).toBe(true);
      });

      it('should detect French "voiture"', () => {
        const result = parseVoiceSearch('Ferry avec voiture', 'fr');
        expect(result.hasVehicle).toBe(true);
      });

      it('should detect "camper"', () => {
        const result = parseVoiceSearch('Traveling with camper');
        expect(result.hasVehicle).toBe(true);
      });

      it('should not detect vehicle when not mentioned', () => {
        const result = parseVoiceSearch('Ferry from Tunis to Marseille');
        expect(result.hasVehicle).toBe(false);
      });
    });

    describe('Confidence score', () => {
      it('should have higher confidence with more information', () => {
        const simple = parseVoiceSearch('Ferry');
        const withPorts = parseVoiceSearch('From Tunis to Marseille');
        const complete = parseVoiceSearch('Round trip from Tunis to Marseille tomorrow with car');

        expect(withPorts.confidence).toBeGreaterThan(simple.confidence);
        expect(complete.confidence).toBeGreaterThan(withPorts.confidence);
      });

      it('should add confidence for each detected element', () => {
        const result = parseVoiceSearch('Round trip from Tunis to Marseille');
        // Round trip: +10, departure: +30, arrival: +30 = 70
        expect(result.confidence).toBeGreaterThanOrEqual(70);
      });

      it('should cap confidence at 100', () => {
        const result = parseVoiceSearch('Round trip from Tunis to Marseille tomorrow returning Friday with car');
        expect(result.confidence).toBeLessThanOrEqual(100);
      });
    });

    describe('Complex queries', () => {
      beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2025-06-15'));
      });

      afterEach(() => {
        jest.useRealTimers();
      });

      it('should parse full query with all elements', () => {
        const result = parseVoiceSearch('Round trip from Tunis to Marseille on July 20 returning July 27 for 2 adults and 1 child with car');

        expect(result.departurePort).toBe('tunis');
        expect(result.arrivalPort).toBe('marseille');
        expect(result.departureDate).toBe('2025-07-20');
        expect(result.returnDate).toBe('2025-07-27');
        expect(result.isRoundTrip).toBe(true);
        expect(result.adults).toBe(2);
        expect(result.children).toBe(1);
        expect(result.hasVehicle).toBe(true);
      });

      it('should handle Italian port names', () => {
        const result = parseVoiceSearch('Ferry from Palermo to Trapani');
        expect(result.departurePort).toBe('palermo');
        expect(result.arrivalPort).toBe('trapani');
      });
    });
  });

  describe('getQuerySummary', () => {
    it('should return formatted summary for complete query', () => {
      const parsed: ParsedSearchQuery = {
        departurePort: 'tunis',
        arrivalPort: 'marseille',
        departureDate: '2025-07-20',
        returnDate: '2025-07-27',
        isRoundTrip: true,
        adults: 2,
        children: 1,
        infants: 0,
        hasVehicle: true,
        confidence: 85,
        rawText: 'test',
      };

      const summary = getQuerySummary(parsed);
      expect(summary).toContain('TUNIS → MARSEILLE');
      expect(summary).toContain('3 passengers');
    });

    it('should show "From PORT" when only departure is set', () => {
      const parsed: ParsedSearchQuery = {
        departurePort: 'tunis',
        arrivalPort: null,
        departureDate: null,
        returnDate: null,
        isRoundTrip: false,
        adults: 1,
        children: 0,
        infants: 0,
        hasVehicle: false,
        confidence: 30,
        rawText: 'test',
      };

      const summary = getQuerySummary(parsed);
      expect(summary).toContain('From TUNIS');
    });

    it('should show "To PORT" when only arrival is set', () => {
      const parsed: ParsedSearchQuery = {
        departurePort: null,
        arrivalPort: 'marseille',
        departureDate: null,
        returnDate: null,
        isRoundTrip: false,
        adults: 1,
        children: 0,
        infants: 0,
        hasVehicle: false,
        confidence: 30,
        rawText: 'test',
      };

      const summary = getQuerySummary(parsed);
      expect(summary).toContain('To MARSEILLE');
    });

    it('should show "(Round trip)" when round trip without return date', () => {
      const parsed: ParsedSearchQuery = {
        departurePort: 'tunis',
        arrivalPort: 'marseille',
        departureDate: '2025-07-20',
        returnDate: null,
        isRoundTrip: true,
        adults: 1,
        children: 0,
        infants: 0,
        hasVehicle: false,
        confidence: 70,
        rawText: 'test',
      };

      const summary = getQuerySummary(parsed);
      expect(summary).toContain('(Round trip)');
    });

    it('should return default message when no parameters detected', () => {
      const parsed: ParsedSearchQuery = {
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
        rawText: '',
      };

      const summary = getQuerySummary(parsed);
      expect(summary).toBe('No search parameters detected');
    });

    it('should not show passenger count when only 1 passenger', () => {
      const parsed: ParsedSearchQuery = {
        departurePort: 'tunis',
        arrivalPort: 'marseille',
        departureDate: null,
        returnDate: null,
        isRoundTrip: false,
        adults: 1,
        children: 0,
        infants: 0,
        hasVehicle: false,
        confidence: 60,
        rawText: 'test',
      };

      const summary = getQuerySummary(parsed);
      expect(summary).not.toContain('passengers');
    });
  });
});
