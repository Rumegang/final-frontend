export const REGIONS = [
  'Manado',
  'Bitung',
  'Tomohon',
  'Kotamobagu',
  'Minahasa',
  'Minahasa Selatan',
  'Minahasa Tenggara',
  'Minahasa Utara',
  'Bolaang Mongondow',
  'Bolaang Mongondow Utara',
  'Bolaang Mongondow Selatan',
  'Bolaang Mongondow Timur',
  'Kepulauan Sangihe',
  'Kepulauan Talaud',
  'Kepulauan Siau Tagulandang Biaro'
] as const;

export type Region = typeof REGIONS[number];

export const DESTINATION_CATEGORIES = [
  'Pantai',
  'Pulau & Bawah Laut',
  'Ekowisata Mangrove',
  'Spot Diving/Snorkeling',
  'Kuliner Pesisir',
  'Gunung & Pendakian',
  'Air Terjun',
  'Danau',
  'Budaya & Sejarah'
] as const;

export type Category = typeof DESTINATION_CATEGORIES[number];

export interface DestinationReview {
  id: string;
  userId: string;
  userName: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export interface MarineWeatherForecast {
  time: string[];
  waveHeight: number[];
  waveDirection?: number[];
  windSpeed: number[];
  surfaceTemperature?: number[];
  currentSafetyLevel: 'AMAN' | 'WASPADA' | 'BAHAYA';
  safetyRecommendation: string;
}

export interface Destination {
  id: string;
  name: string;
  region: Region;
  category: Category;
  description: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  entryFee?: number; // in IDR; omitted when the current rate is unverified
  boatFee: number; // in IDR (0 if not needed)
  gearRentFee: number; // in IDR
  isFamilyFriendly: boolean;
  isSnorkelingSpot: boolean;
  isDivingSpot: boolean;
  waveConditionDefault: 'Tenang' | 'Sedang' | 'Berombak';
  bestTimeToVisit: string;
  facilities: string[];
  imageUrl: string;
  rating: number;
  reviewCount: number;
  aiReviewSummary?: {
    positivePoints: string[];
    cautionPoints: string[];
    tips: string;
    lastGenerated: string;
  };
  reviews?: DestinationReview[];
}

export function isMarineCategory(category: Category): boolean {
  return [
    'Pantai',
    'Pulau & Bawah Laut',
    'Ekowisata Mangrove',
    'Spot Diving/Snorkeling',
    'Kuliner Pesisir'
  ].includes(category);
}

export interface UserTripQuery {
  days: number;
  budget: number;
  regions: Region[];
  isFamilyWithChildren: boolean;
  likesSnorkeling: boolean;
  likesDiving: boolean;
  preferredCategories: Category[];
  customNotes?: string;
}

export interface TripItineraryDay {
  dayNumber: number;
  dateStr?: string;
  title: string;
  items: {
    time: string;
    destinationId: string;
    destinationName: string;
    activity: string;
    estimatedCost: number;
    marineSafetyStatus?: string;
    tips: string;
  }[];
  totalDayCost: number;
}

export interface TripItinerary {
  id: string;
  userId?: string;
  title: string;
  createdAt: string;
  querySummary: string;
  totalBudget: number;
  estimatedTotalCost: number;
  days: TripItineraryDay[];
  rationale: string;
  safetyAdvisory: string;
}
