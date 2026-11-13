import { Component, ElementRef, Input, ViewChild } from '@angular/core';
import { ModalController } from '@ionic/angular';

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const ZOOM_STEP = 0.35;

@Component({
  selector: 'app-image-lightbox',
  templateUrl: './image-lightbox.component.html',
  styleUrls: ['./image-lightbox.component.scss'],
  standalone: false,
})
export class ImageLightboxComponent {
  @Input() imageSrc = '';
  @Input() imageAlt = '';

  @ViewChild('viewport') viewportRef?: ElementRef<HTMLElement>;
  @ViewChild('imageEl') imageRef?: ElementRef<HTMLImageElement>;

  scale = MIN_SCALE;
  translateX = 0;
  translateY = 0;

  private pinchStartDistance = 0;
  private pinchStartScale = MIN_SCALE;
  private pinchActive = false;
  private panActive = false;
  private panLastX = 0;
  private panLastY = 0;

  constructor(private readonly modalCtrl: ModalController) {}

  get transformStyle(): string {
    return `translate3d(${this.translateX}px, ${this.translateY}px, 0) scale(${this.scale})`;
  }

  get canZoomOut(): boolean {
    return this.scale > MIN_SCALE + 0.001;
  }

  get canResetZoom(): boolean {
    return (
      this.scale > MIN_SCALE + 0.001 ||
      Math.abs(this.translateX) > 0.5 ||
      Math.abs(this.translateY) > 0.5
    );
  }

  onImageLoad(): void {
    this.clampPan();
  }

  zoomIn(): void {
    this.scale = Math.min(MAX_SCALE, this.scale + ZOOM_STEP);
    this.clampPan();
  }

  zoomOut(): void {
    this.scale = Math.max(MIN_SCALE, this.scale - ZOOM_STEP);
    if (this.scale <= MIN_SCALE) {
      this.scale = MIN_SCALE;
      this.translateX = 0;
      this.translateY = 0;
    }
    this.clampPan();
  }

  resetZoom(): void {
    this.scale = MIN_SCALE;
    this.translateX = 0;
    this.translateY = 0;
  }

  onContentClick(): void {
    if (this.scale <= MIN_SCALE) {
      this.dismiss();
    }
  }

  onViewportClick(event: MouseEvent): void {
    if (this.scale <= MIN_SCALE) {
      this.dismiss();
      return;
    }
    event.stopPropagation();
  }

  dismiss(): void {
    void this.modalCtrl.dismiss();
  }

  onTouchStart(event: TouchEvent): void {
    if (event.touches.length === 2) {
      this.pinchActive = true;
      this.panActive = false;
      this.pinchStartScale = this.scale;
      this.pinchStartDistance = this.touchDistance(event.touches);
      return;
    }
    if (event.touches.length === 1 && this.scale > MIN_SCALE) {
      this.panActive = true;
      this.pinchActive = false;
      this.panLastX = event.touches[0].clientX;
      this.panLastY = event.touches[0].clientY;
    }
  }

  onTouchMove(event: TouchEvent): void {
    if (this.pinchActive && event.touches.length >= 2) {
      event.preventDefault();
      const distance = this.touchDistance(event.touches);
      if (this.pinchStartDistance > 0) {
        const next = this.pinchStartScale * (distance / this.pinchStartDistance);
        this.scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, next));
        if (this.scale <= MIN_SCALE) {
          this.scale = MIN_SCALE;
          this.translateX = 0;
          this.translateY = 0;
        }
        this.clampPan();
      }
      return;
    }
    if (this.panActive && event.touches.length === 1 && this.scale > MIN_SCALE) {
      event.preventDefault();
      const touch = event.touches[0];
      const dx = touch.clientX - this.panLastX;
      const dy = touch.clientY - this.panLastY;
      this.panLastX = touch.clientX;
      this.panLastY = touch.clientY;
      this.translateX += dx;
      this.translateY += dy;
      this.clampPan();
    }
  }

  onTouchEnd(event: TouchEvent): void {
    if (event.touches.length < 2) {
      this.pinchActive = false;
    }
    if (event.touches.length === 0) {
      this.panActive = false;
      this.pinchActive = false;
    } else if (event.touches.length === 1 && this.scale > MIN_SCALE) {
      this.panActive = true;
      this.panLastX = event.touches[0].clientX;
      this.panLastY = event.touches[0].clientY;
    }
  }

  onPointerDown(event: PointerEvent): void {
    if (event.pointerType !== 'mouse' || event.button !== 0 || this.scale <= MIN_SCALE) {
      return;
    }
    this.panActive = true;
    this.panLastX = event.clientX;
    this.panLastY = event.clientY;
    try {
      (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
    } catch {
      // ignore
    }
  }

  onPointerMove(event: PointerEvent): void {
    if (!this.panActive || this.scale <= MIN_SCALE) return;
    if (event.pointerType === 'mouse' && event.buttons !== 1) {
      this.panActive = false;
      return;
    }
    event.preventDefault();
    const dx = event.clientX - this.panLastX;
    const dy = event.clientY - this.panLastY;
    this.panLastX = event.clientX;
    this.panLastY = event.clientY;
    this.translateX += dx;
    this.translateY += dy;
    this.clampPan();
  }

  onPointerUp(): void {
    this.panActive = false;
  }

  private touchDistance(touches: TouchList): number {
    const a = touches[0];
    const b = touches[1];
    const dx = a.clientX - b.clientX;
    const dy = a.clientY - b.clientY;
    return Math.hypot(dx, dy);
  }

  private clampPan(): void {
    const viewport = this.viewportRef?.nativeElement;
    const img = this.imageRef?.nativeElement;
    if (!viewport || !img || this.scale <= MIN_SCALE) {
      if (this.scale <= MIN_SCALE) {
        this.translateX = 0;
        this.translateY = 0;
      }
      return;
    }

    const viewportW = viewport.clientWidth;
    const viewportH = viewport.clientHeight;
    const baseW = img.clientWidth;
    const baseH = img.clientHeight;
    const scaledW = baseW * this.scale;
    const scaledH = baseH * this.scale;

    const maxX = Math.max(0, (scaledW - viewportW) / 2);
    const maxY = Math.max(0, (scaledH - viewportH) / 2);

    this.translateX = Math.min(maxX, Math.max(-maxX, this.translateX));
    this.translateY = Math.min(maxY, Math.max(-maxY, this.translateY));
  }
}
