import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'app-screen-help',
  templateUrl: './app-screen-help.component.html',
  styleUrls: ['./app-screen-help.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class AppScreenHelpComponent {
  /** Id único do trigger (obrigatório se houver mais de um botão na mesma página). */
  @Input({ required: true }) helpId!: string;
  @Input({ required: true }) bodyKey!: string;
  @Input() titleKey = 'help.title';
}
