package com.mylibrary.repository;

import com.mylibrary.domain.DictionaryCacheEntry;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DictionaryCacheRepository extends JpaRepository<DictionaryCacheEntry, String> {
}
