package com.mylibrary.repository;

import com.mylibrary.domain.Book;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface BookRepository extends JpaRepository<Book, Long>, JpaSpecificationExecutor<Book> {

    /**
     * El tipo de libro es el discriminador de la herencia single-table y JPA
     * no permite cambiarlo en una entidad gestionada: se actualiza por SQL y
     * el servicio recarga la entidad ya instanciada como su nueva subclase.
     */
    @Modifying
    @Query(value = "UPDATE books SET type = :type WHERE id = :id", nativeQuery = true)
    void updateDiscriminator(@Param("id") Long id, @Param("type") String type);

    Optional<Book> findByIdAndUserId(Long id, Long userId);

    List<Book> findAllByUserIdOrderByCreatedAtDesc(Long userId);

    long countByUserId(Long userId);

    boolean existsByCategoriesIdAndUserId(Long categoryId, Long userId);

    long countBySagaId(Long sagaId);
}
