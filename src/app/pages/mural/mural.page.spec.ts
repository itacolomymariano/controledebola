import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MuralPage } from './mural.page';

describe('MuralPage', () => {
  let component: MuralPage;
  let fixture: ComponentFixture<MuralPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(MuralPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
