package com.aiexcel.pivotexport;

import com.aiexcel.pivotexport.config.PivotExportProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

@SpringBootApplication
@EnableConfigurationProperties(PivotExportProperties.class)
public class PivotExportApplication {

  public static void main(String[] args) {
    SpringApplication.run(PivotExportApplication.class, args);
  }
}
