# Test Coverage Analysis - Tiny Closet

## Executive Summary

**Current Test Coverage: 0%**

The Tiny Closet codebase currently has **no testing infrastructure** installed and **zero test files**. This analysis identifies critical areas that need test coverage and provides a prioritized roadmap for implementing a comprehensive testing strategy.

---

## Current State

| Metric | Value |
|--------|-------|
| Total Lines of Code | ~3,211 |
| Test Files | 0 |
| Test Coverage | 0% |
| Testing Dependencies | None |
| Test Scripts | None |

---

## Recommended Testing Setup

### 1. Install Testing Dependencies

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom msw @types/testing-library__jest-dom
```

**Why these tools:**
- **Vitest**: Fast, native ESM support, works seamlessly with Vite
- **React Testing Library**: Industry standard for component testing
- **jsdom**: Browser environment simulation
- **msw (Mock Service Worker)**: Mock API calls (Gemini AI, Weather API)

### 2. Add Test Scripts to package.json

```json
{
  "scripts": {
    "test": "vitest",
    "test:watch": "vitest --watch",
    "test:coverage": "vitest --coverage",
    "test:ui": "vitest --ui"
  }
}
```

### 3. Create Vitest Configuration

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: ['node_modules/', 'test/']
    }
  }
})
```

---

## Priority Areas for Testing

### Priority 1: Critical Business Logic (High Impact, High Testability)

These pure functions and utilities have complex logic that directly affects user experience.

#### 1.1 Age Calculation Functions (`Dashboard.tsx`)

**Location**: `Dashboard.tsx:85-130`

**Functions to test:**
- `calculateAge(birthDate)` - Formats age as "X years, Y months"
- `getAgeInMonths(birthDate)` - Returns total months
- `parseSizeToMaxMonths(size)` - Parses size strings like "NB", "3M", "2T", "5Y"

**Test Cases:**
```typescript
describe('calculateAge', () => {
  it('should return "1 year, 0 months" for exactly 1 year old')
  it('should return "0 years, 6 months" for 6 month old')
  it('should handle leap years correctly')
  it('should pluralize correctly (1 year vs 2 years)')
})

describe('parseSizeToMaxMonths', () => {
  it('should parse "NB" as 0-1 months')
  it('should parse "3M" as 3 months')
  it('should parse "2T" as 24 months (toddler)')
  it('should parse "5Y" as 60 months')
  it('should handle edge cases like "12-18M" ranges')
  it('should return null for unrecognized sizes')
})
```

**Why Priority 1:** These calculations determine which clothes are suggested as "too small" or appropriate for the child. Incorrect parsing could hide valid items or suggest outgrown clothes.

---

#### 1.2 Color Matching & Palette Classification (`Dashboard.tsx`)

**Location**: `Dashboard.tsx:140-220`

**Functions to test:**
- Color palette classification (neutrals, earthy, pastels, vibrant)
- Monochrome detection
- Tonal/complementary color matching

**Test Cases:**
```typescript
describe('Color Palette Classification', () => {
  it('should classify "white", "black", "gray" as neutrals')
  it('should classify "beige", "tan", "olive" as earthy')
  it('should classify "light pink", "baby blue" as pastels')
  it('should classify "red", "bright yellow" as vibrant')
})

describe('Monochrome Detection', () => {
  it('should detect all-black outfit as monochrome')
  it('should detect navy + denim as tonal match')
  it('should not flag red + blue as monochrome')
})
```

**Why Priority 1:** Color matching is the core AI feature for outfit recommendations. Wrong classifications lead to poor outfit suggestions.

---

#### 1.3 Weather-Based Filtering (`Dashboard.tsx`, `weatherService.ts`)

**Location**: `weatherService.ts:1-85`, `Dashboard.tsx:250-300`

**Functions to test:**
- `getCoordinates()` - Geolocation wrapper
- `fetchWeather()` - Weather API integration
- WMO weather code mapping
- Season filtering based on temperature

**Test Cases:**
```typescript
describe('Weather Service', () => {
  it('should map WMO code 0-3 to "sunny"')
  it('should map WMO code 61-67 to "rainy"')
  it('should return fallback weather on API error')
  it('should round temperature to nearest integer')
})

describe('Season Filtering', () => {
  it('should include "All Year" items in any weather')
  it('should filter summer items when temp > 70F')
  it('should filter winter items when temp < 40F')
})
```

---

### Priority 2: Data Layer (Medium Impact, High Testability)

#### 2.1 Database Operations (`db.ts`)

**Location**: `db.ts:1-50`

**Test Cases:**
```typescript
describe('Database Initialization', () => {
  it('should create database with 3 tables')
  it('should apply migrations v1 through v4')
  it('should migrate "Sleepwear" category to "Pajamas"')
  it('should create default profile if none exists')
})

describe('ClothingItem CRUD', () => {
  it('should add new clothing item')
  it('should update existing item')
  it('should archive item (soft delete)')
  it('should query by category')
  it('should query by season')
})
```

---

#### 2.2 Filter & Sort Logic (`Closet.tsx`)

**Location**: `Closet.tsx:80-200`

**Test Cases:**
```typescript
describe('Closet Filtering', () => {
  it('should filter by single category')
  it('should filter by multiple seasons')
  it('should search across brand, description, color')
  it('should combine multiple filters correctly')
  it('should exclude archived items by default')
  it('should show only archived items when toggled')
})

describe('Brand Extraction', () => {
  it('should group items by brand with counts')
  it('should handle items without brand')
  it('should sort brands alphabetically')
})
```

---

### Priority 3: API Integration (Medium Impact, Medium Testability)

#### 3.1 Gemini AI Image Analysis (`geminiService.ts`)

**Location**: `geminiService.ts:1-474`

**Functions to test:**
- `analyzeClothingImage()` - Main image analysis
- Image preprocessing (resize, compress)
- Bounding box extraction and clamping
- JSON parsing from AI response

**Test Cases:**
```typescript
describe('Image Preprocessing', () => {
  it('should resize images larger than 1024px')
  it('should maintain aspect ratio')
  it('should compress to target quality')
})

describe('Bounding Box Calculations', () => {
  it('should clamp bounding box to image bounds')
  it('should add padding around detected item')
  it('should handle multiple items in single image')
})

describe('AI Response Parsing', () => {
  it('should parse valid JSON response')
  it('should extract category from response')
  it('should handle malformed JSON gracefully')
  it('should return default values on API error')
})
```

**Note:** Use MSW to mock Gemini API responses for deterministic testing.

---

### Priority 4: Component Rendering (Lower Impact, Medium Testability)

#### 4.1 Page Components

**Test Cases:**
```typescript
describe('Dashboard', () => {
  it('should render outfit suggestions')
  it('should display weather widget')
  it('should show empty state when no items')
  it('should navigate to closet on "View All" click')
})

describe('AddItem', () => {
  it('should display camera/upload buttons')
  it('should show crop interface after image selection')
  it('should save item to database on confirm')
  it('should validate required fields')
})

describe('Settings', () => {
  it('should display current profile')
  it('should save profile changes')
  it('should confirm before deleting profile')
})
```

---

#### 4.2 UI Components

**Test Cases:**
```typescript
describe('Navbar', () => {
  it('should highlight active route')
  it('should navigate to correct page on click')
})

describe('ItemDetailModal', () => {
  it('should display item details')
  it('should enable edit mode on button click')
  it('should save changes on confirm')
})

describe('WeatherWidget', () => {
  it('should display temperature')
  it('should show weather icon')
  it('should handle loading state')
})
```

---

### Priority 5: Complex Interactions (Lower Impact, Low Testability)

#### 5.1 Touch Gesture Handling (`AddItem.tsx`)

**Location**: `AddItem.tsx:200-450`

These are challenging to test but critical for mobile UX:

**Test Cases:**
```typescript
describe('Touch Gestures', () => {
  it('should pan image on single finger drag')
  it('should zoom on pinch gesture')
  it('should resize crop area on corner drag')
  it('should constrain crop within image bounds')
})
```

**Recommendation:** Consider using Cypress or Playwright for E2E testing of touch interactions.

---

## Testing Roadmap

### Phase 1: Foundation (Week 1)
- [ ] Set up Vitest with React Testing Library
- [ ] Configure coverage reporting
- [ ] Create test utilities and mocks
- [ ] Test age calculation functions (Priority 1.1)

### Phase 2: Core Logic (Week 2)
- [ ] Test color matching functions (Priority 1.2)
- [ ] Test weather service (Priority 1.3)
- [ ] Test database operations (Priority 2.1)

### Phase 3: Data Layer (Week 3)
- [ ] Test filter/sort logic (Priority 2.2)
- [ ] Test Gemini service with mocks (Priority 3.1)

### Phase 4: Components (Week 4)
- [ ] Test page components (Priority 4.1)
- [ ] Test UI components (Priority 4.2)

### Phase 5: E2E (Optional)
- [ ] Set up Cypress or Playwright
- [ ] Test critical user flows
- [ ] Test touch gesture interactions

---

## Coverage Goals

| Phase | Target Coverage | Focus Areas |
|-------|-----------------|-------------|
| Phase 1 | 10% | Utility functions |
| Phase 2 | 30% | Core business logic |
| Phase 3 | 50% | Data layer + API mocks |
| Phase 4 | 70% | Components |
| Phase 5 | 80%+ | E2E flows |

---

## Files to Create

```
/home/user/Tiny-Closet/
├── vitest.config.ts                 # Vitest configuration
├── src/
│   └── test/
│       ├── setup.ts                 # Test setup (jsdom, matchers)
│       ├── mocks/
│       │   ├── handlers.ts          # MSW API mock handlers
│       │   └── db.ts                # Mock database
│       └── utils/
│           └── testUtils.tsx        # Render helpers, providers
├── __tests__/                       # or colocate with source files
│   ├── utils/
│   │   ├── ageCalculations.test.ts
│   │   ├── colorMatching.test.ts
│   │   └── sizeParser.test.ts
│   ├── services/
│   │   ├── weatherService.test.ts
│   │   └── geminiService.test.ts
│   ├── pages/
│   │   ├── Dashboard.test.tsx
│   │   ├── Closet.test.tsx
│   │   └── AddItem.test.tsx
│   └── components/
│       ├── Navbar.test.tsx
│       └── WeatherWidget.test.tsx
```

---

## Key Risks Without Testing

1. **Age/Size Calculation Bugs**: Could recommend outgrown clothes or hide valid items
2. **Color Matching Errors**: Poor outfit recommendations hurt core feature value
3. **Database Migrations**: Breaking changes could corrupt user data
4. **API Integration Failures**: Unhandled errors could crash the app
5. **Filter Logic Bugs**: Users might not find their clothes

---

## Conclusion

The Tiny Closet application has **zero test coverage**, which poses significant risks for a production application managing user data. The recommended approach is to:

1. **Start with pure functions** (age calculations, color matching) - highest ROI
2. **Add API mocks** for external services (Gemini, Weather)
3. **Test data layer** to prevent data corruption
4. **Add component tests** for critical user flows
5. **Consider E2E tests** for complex touch interactions

Estimated effort: 2-4 weeks for 70% coverage on critical paths.
