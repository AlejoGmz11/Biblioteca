import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { SearchBarComponent } from './search-bar.component';

describe('SearchBarComponent', () => {
  let fixture: ComponentFixture<SearchBarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SearchBarComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(SearchBarComponent);
    fixture.detectChanges();
  });

  function type(value: string): void {
    const input: HTMLInputElement = fixture.nativeElement.querySelector('input');
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  it('debounces the emitted search term', fakeAsync(() => {
    const emitted: string[] = [];
    fixture.componentInstance.search.subscribe((term) => emitted.push(term));

    type('du');
    type('dun');
    type('dune');
    expect(emitted).toEqual([]);

    tick(300);
    expect(emitted).toEqual(['dune']);
  }));

  it('does not re-emit identical consecutive terms', fakeAsync(() => {
    const emitted: string[] = [];
    fixture.componentInstance.search.subscribe((term) => emitted.push(term));

    type('dune');
    tick(300);
    type('dune');
    tick(300);

    expect(emitted).toEqual(['dune']);
  }));
});
