package com.mylibrary.domain;

import jakarta.persistence.*;
import lombok.*;

/**
 * Agrupa libros de un usuario que forman parte de una misma saga, trilogía o
 * bilogía. Los libros sin saga son autoconclusivos.
 */
@Entity
@Table(name = "sagas")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Saga {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;
}
