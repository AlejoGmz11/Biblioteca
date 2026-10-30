package com.mylibrary.domain;

import jakarta.persistence.DiscriminatorValue;
import jakarta.persistence.Entity;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

@Entity
@DiscriminatorValue("DIGITAL")
@SuperBuilder
@NoArgsConstructor
public class DigitalBook extends Book {

    @Override
    public BookType getBookType() {
        return BookType.DIGITAL;
    }
}
