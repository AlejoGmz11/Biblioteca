export type BookType = 'PHYSICAL' | 'DIGITAL' | 'AUDIOBOOK';
export type ReadingStatus = 'PENDING' | 'READING' | 'FINISHED';
export type EbookFormat = 'PDF' | 'EPUB';

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  timestamp: string;
}

export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
}

export interface User {
  id: number;
  username: string;
  email: string;
  avatarUrl: string | null;
  readingGoal: number | null;
  createdAt: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface Category {
  id: number;
  name: string;
  predefined: boolean;
}

export interface Saga {
  id: number;
  name: string;
  bookCount: number;
}

export interface ReadingSession {
  id: number;
  bookId: number;
  status: ReadingStatus;
  startDate: string | null;
  endDate: string | null;
  rating: number | null;
  notes: string | null;
  currentPage: number | null;
  /** Ubicación de lectura EPUB (CFI). */
  ebookLocation: string | null;
  createdAt: string;
}

export interface Book {
  id: number;
  title: string;
  author: string;
  isbn: string | null;
  pages: number | null;
  categories: Category[];
  sagaId: number | null;
  sagaName: string | null;
  sagaOrder: number | null;
  type: BookType;
  imageUrl: string | null;
  imagePath: string | null;
  description: string | null;
  /** null si el libro no tiene ebook adjunto. */
  ebookFormat: EbookFormat | null;
  ebookSize: number | null;
  createdAt: string;
  updatedAt: string;
  session: ReadingSession | null;
}

export interface BookPayload {
  title: string;
  author: string;
  isbn?: string | null;
  pages?: number | null;
  categoryIds?: number[] | null;
  saga?: string | null;
  sagaOrder?: number | null;
  type: BookType;
  imageUrl?: string | null;
  imagePath?: string | null;
  description?: string | null;
}

export interface SessionPatch {
  status?: ReadingStatus;
  startDate?: string | null;
  endDate?: string | null;
  rating?: number | null;
  notes?: string | null;
  currentPage?: number | null;
  ebookLocation?: string | null;
}

export interface Stats {
  totalBooks: number;
  booksByStatus: Record<ReadingStatus, number>;
  totalPagesRead: number;
  booksPerMonth: { month: string; count: number }[];
  pagesPerMonth: { month: string; count: number }[];
  avgDaysPerBook: number;
  ratingDistribution: Record<string, number>;
  activityDays: { date: string; count: number }[];
  booksFinishedThisYear: number;
}

export interface BookFilters {
  status?: ReadingStatus | '';
  category?: number | '';
  type?: BookType | '';
  author?: string;
  search?: string;
  /** id de saga, 'none' para autoconclusivos, o vacío. */
  saga?: string;
  page?: number;
  size?: number;
}

export const READING_STATUS_LABELS: Record<ReadingStatus, string> = {
  PENDING: 'Pendiente',
  READING: 'Leyendo',
  FINISHED: 'Terminado'
};

export const BOOK_TYPE_LABELS: Record<BookType, string> = {
  PHYSICAL: 'Físico',
  DIGITAL: 'Digital',
  AUDIOBOOK: 'Audiolibro'
};
