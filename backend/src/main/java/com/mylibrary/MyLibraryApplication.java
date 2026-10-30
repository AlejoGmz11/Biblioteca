package com.mylibrary;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@SpringBootApplication
@ConfigurationPropertiesScan
public class MyLibraryApplication {

    public static void main(String[] args) {
        SpringApplication.run(MyLibraryApplication.class, args);
    }
}
