import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/login.page').then((m) => m.LoginPage),
    title: 'Iniciar sesión — MyLibrary'
  },
  {
    path: 'register',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/register.page').then((m) => m.RegisterPage),
    title: 'Crear cuenta — MyLibrary'
  },
  {
    path: 'forgot-password',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/forgot-password.page').then((m) => m.ForgotPasswordPage),
    title: 'Recuperar contraseña — MyLibrary'
  },
  {
    path: 'reset-password',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/reset-password.page').then((m) => m.ResetPasswordPage),
    title: 'Nueva contraseña — MyLibrary'
  },
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () => import('./features/dashboard/dashboard.page').then((m) => m.DashboardPage),
    title: 'Panel — MyLibrary'
  },
  {
    path: 'books',
    canActivate: [authGuard],
    loadComponent: () => import('./features/books/books-list.page').then((m) => m.BooksListPage),
    title: 'Mis libros — MyLibrary'
  },
  {
    path: 'books/new',
    canActivate: [authGuard],
    loadComponent: () => import('./features/books/book-form.page').then((m) => m.BookFormPage),
    title: 'Nuevo libro — MyLibrary'
  },
  {
    path: 'books/:id',
    canActivate: [authGuard],
    loadComponent: () => import('./features/books/book-detail.page').then((m) => m.BookDetailPage),
    title: 'Detalle del libro — MyLibrary'
  },
  {
    path: 'books/:id/read',
    canActivate: [authGuard],
    loadComponent: () => import('./features/reader/reader.page').then((m) => m.ReaderPage),
    title: 'Lector — MyLibrary'
  },
  {
    path: 'books/:id/edit',
    canActivate: [authGuard],
    loadComponent: () => import('./features/books/book-form.page').then((m) => m.BookFormPage),
    title: 'Editar libro — MyLibrary'
  },
  {
    path: 'categories',
    canActivate: [authGuard],
    loadComponent: () => import('./features/categories/categories.page').then((m) => m.CategoriesPage),
    title: 'Categorías — MyLibrary'
  },
  {
    path: 'profile',
    canActivate: [authGuard],
    loadComponent: () => import('./features/profile/profile.page').then((m) => m.ProfilePage),
    title: 'Perfil — MyLibrary'
  },
  {
    path: 'export',
    canActivate: [authGuard],
    loadComponent: () => import('./features/export/export.page').then((m) => m.ExportPage),
    title: 'Exportar datos — MyLibrary'
  },
  { path: '**', redirectTo: 'dashboard' }
];
