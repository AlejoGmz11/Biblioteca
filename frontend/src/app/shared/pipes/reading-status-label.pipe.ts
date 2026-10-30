import { Pipe, PipeTransform } from '@angular/core';
import { READING_STATUS_LABELS, ReadingStatus } from '../../core/models';

@Pipe({ name: 'readingStatusLabel' })
export class ReadingStatusLabelPipe implements PipeTransform {
  transform(value: ReadingStatus | null | undefined): string {
    return value ? READING_STATUS_LABELS[value] : '';
  }
}
