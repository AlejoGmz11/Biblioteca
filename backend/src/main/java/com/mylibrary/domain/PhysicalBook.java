package com.mylibrary.domain;

import jakarta.persistence.DiscriminatorValue;
import jakarta.persistence.Entity;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

@Entity
@DiscriminatorValue("PHYSICAL")
@SuperBuilder
@NoArgsConstructor
public class PhysicalBook extends Book {

    @Override
    public BookType getBookType() {
        return BookType.PHYSICAL;
    }
}
