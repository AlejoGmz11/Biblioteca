import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StarRatingComponent } from './star-rating.component';

describe('StarRatingComponent', () => {
  let fixture: ComponentFixture<StarRatingComponent>;
  let component: StarRatingComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StarRatingComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(StarRatingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  function stars(): HTMLButtonElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('button'));
  }

  /** Dispara un click en la mitad izquierda (media) o derecha (entera) de la estrella. */
  function clickStar(index: number, half: 'left' | 'right'): void {
    const button = stars()[index];
    const rect = button.getBoundingClientRect();
    const x = half === 'left' ? rect.left + rect.width * 0.25 : rect.left + rect.width * 0.75;
    button.dispatchEvent(new MouseEvent('click', { clientX: x, bubbles: true }));
    fixture.detectChanges();
  }

  it('renders five stars', () => {
    expect(stars().length).toBe(5);
  });

  it('sets a full star when clicking the right half', () => {
    clickStar(3, 'right');

    expect(component.rating()).toBe(4);
  });

  it('sets a half star when clicking the left half', () => {
    clickStar(3, 'left');

    expect(component.rating()).toBe(3.5);
  });

  it('clears the rating when the same value is clicked again', () => {
    clickStar(2, 'right');
    clickStar(2, 'right');

    expect(component.rating()).toBe(0);
  });

  it('fills stars partially for half values', () => {
    component.rating.set(3.5);
    fixture.detectChanges();

    expect(component.fillPercent(3)).toBe(100);
    expect(component.fillPercent(4)).toBe(50);
    expect(component.fillPercent(5)).toBe(0);
  });

  it('does not change rating in readonly mode', () => {
    fixture.componentRef.setInput('readonly', true);
    fixture.detectChanges();

    clickStar(4, 'right');

    expect(component.rating()).toBe(0);
  });

  it('supports arrow-key adjustment in half steps', () => {
    component.rating.set(2);
    component.selectNext(0.5);
    expect(component.rating()).toBe(2.5);

    component.selectNext(-0.5);
    expect(component.rating()).toBe(2);

    component.rating.set(5);
    component.selectNext(0.5);
    expect(component.rating()).toBe(5);
  });
});
