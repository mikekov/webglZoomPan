import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { TwoDViewerComponent } from './two-d-viewer.component';

describe('TwoDViewerComponent', () => {
  let component: TwoDViewerComponent;
  let fixture: ComponentFixture<TwoDViewerComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ TwoDViewerComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(TwoDViewerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
