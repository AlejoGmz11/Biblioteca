import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ClickOutsideDirective } from './click-outside.directive';

@Component({
  imports: [ClickOutsideDirective],
  template: `
    <div id="inside" (appClickOutside)="outsideClicks = outsideClicks + 1">
      <button id="child" type="button">Dentro</button>
    </div>
    <button id="outside" type="button">Fuera</button>
  `
})
class HostComponent {
  outsideClicks = 0;
}

describe('ClickOutsideDirective', () => {
  let fixture: ComponentFixture<HostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
  });

  it('emits when clicking outside the host', () => {
    (fixture.nativeElement.querySelector('#outside') as HTMLElement).click();
    expect(fixture.componentInstance.outsideClicks).toBe(1);
  });

  it('does not emit when clicking inside the host', () => {
    (fixture.nativeElement.querySelector('#child') as HTMLElement).click();
    expect(fixture.componentInstance.outsideClicks).toBe(0);
  });
});
