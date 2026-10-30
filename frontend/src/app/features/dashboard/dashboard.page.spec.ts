import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { DashboardPage } from './dashboard.page';
import { environment } from '../../../environments/environment';
import { Stats } from '../../core/models';

const emptyStats: Stats = {
  totalBooks: 0,
  booksByStatus: { PENDING: 0, READING: 0, FINISHED: 0 },
  totalPagesRead: 0,
  booksPerMonth: [],
  avgDaysPerBook: 0
};

describe('DashboardPage', () => {
  let fixture: ComponentFixture<DashboardPage>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardPage],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardPage);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  async function renderAndGetRequest() {
    fixture.detectChanges();
    await fixture.whenStable(); // afterNextRender dispara la carga
    return httpMock.expectOne(`${environment.apiUrl}/stats/dashboard`);
  }

  it('shows an error state instead of loading forever when the request fails', async () => {
    const req = await renderAndGetRequest();
    req.flush('boom', { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('No se pudieron cargar las estadísticas');
    expect(text).not.toContain('Cargando estadísticas');
  });

  it('retry reloads the stats after a failure', async () => {
    const req = await renderAndGetRequest();
    req.flush('boom', { status: 0, statusText: 'Connection refused' });
    fixture.detectChanges();

    const retryButton: HTMLButtonElement = fixture.nativeElement.querySelector('[role="alert"] button');
    retryButton.click();
    fixture.detectChanges();

    httpMock
      .expectOne(`${environment.apiUrl}/stats/dashboard`)
      .flush({ success: true, message: 'OK', data: emptyStats, timestamp: '' });
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Total de libros');
    expect(text).not.toContain('No se pudieron cargar');
  });
});
