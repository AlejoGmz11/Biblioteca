import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PaginationComponent } from './pagination.component';

describe('PaginationComponent', () => {
  let fixture: ComponentFixture<PaginationComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PaginationComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(PaginationComponent);
  });

  it('renders nothing with a single page', () => {
    fixture.componentRef.setInput('page', 0);
    fixture.componentRef.setInput('totalPages', 1);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('nav')).toBeNull();
  });

  it('emits pageChange when clicking another page', () => {
    fixture.componentRef.setInput('page', 0);
    fixture.componentRef.setInput('totalPages', 3);
    fixture.detectChanges();

    const emitted: number[] = [];
    fixture.componentInstance.pageChange.subscribe((p) => emitted.push(p));

    const buttons: HTMLButtonElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('button')
    );
    // [prev, 1, 2, 3, next] -> click page "2"
    buttons[2].click();

    expect(emitted).toEqual([1]);
  });

  it('disables previous on the first page and next on the last', () => {
    fixture.componentRef.setInput('page', 0);
    fixture.componentRef.setInput('totalPages', 3);
    fixture.detectChanges();

    const buttons: HTMLButtonElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('button')
    );
    expect(buttons[0].disabled).toBeTrue();
    expect(buttons[buttons.length - 1].disabled).toBeFalse();
  });

  it('marks the current page with aria-current', () => {
    fixture.componentRef.setInput('page', 1);
    fixture.componentRef.setInput('totalPages', 3);
    fixture.detectChanges();

    const current = fixture.nativeElement.querySelector('[aria-current="page"]');
    expect(current?.textContent?.trim()).toBe('2');
  });
});
