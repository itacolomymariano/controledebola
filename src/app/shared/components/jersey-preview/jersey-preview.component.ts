import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-jersey-preview',
  templateUrl: './jersey-preview.component.html',
  styleUrls: ['./jersey-preview.component.scss'],
  standalone: false,
})
export class JerseyPreviewComponent {
  @Input({ required: true }) colors!: [string, string, string];
  @Input() size: 'sm' | 'md' = 'md';
}
