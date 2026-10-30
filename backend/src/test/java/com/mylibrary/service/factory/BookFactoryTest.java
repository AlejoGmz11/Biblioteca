package com.mylibrary.service.factory;

import com.mylibrary.domain.AudioBook;
import com.mylibrary.domain.BookType;
import com.mylibrary.domain.DigitalBook;
import com.mylibrary.domain.PhysicalBook;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

import static org.assertj.core.api.Assertions.assertThat;

class BookFactoryTest {

    private final BookFactory factory = new BookFactory();

    @Test
    void createsConcreteSubtypes() {
        assertThat(factory.create(BookType.PHYSICAL)).isInstanceOf(PhysicalBook.class);
        assertThat(factory.create(BookType.DIGITAL)).isInstanceOf(DigitalBook.class);
        assertThat(factory.create(BookType.AUDIOBOOK)).isInstanceOf(AudioBook.class);
    }

    @ParameterizedTest
    @EnumSource(BookType.class)
    void createdBookReportsItsOwnType(BookType type) {
        assertThat(factory.create(type).getBookType()).isEqualTo(type);
    }
}
