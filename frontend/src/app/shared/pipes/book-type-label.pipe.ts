import { Pipe, PipeTransform } from '@angular/core';
import { BOOK_TYPE_LABELS, BookType } from '../../core/models';

@Pipe({ name: 'bookTypeLabel' })
export class BookTypeLabelPipe implements PipeTransform {
  transform(value: BookType | null | undefined): string {
    return value ? BOOK_TYPE_LABELS[value] : '';
  }
}
