package com.mylibrary.domain;

import jakarta.persistence.DiscriminatorValue;
import jakarta.persistence.Entity;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

@Entity
@DiscriminatorValue("AUDIOBOOK")
@SuperBuilder
@NoArgsConstructor
public class AudioBook extends Book {

    @Override
    public BookType getBookType() {
        return BookType.AUDIOBOOK;
    }
}
