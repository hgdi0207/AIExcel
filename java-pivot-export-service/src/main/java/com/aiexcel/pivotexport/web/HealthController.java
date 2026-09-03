package com.aiexcel.pivotexport.web;

import com.aiexcel.pivotexport.model.HealthResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class HealthController {

  @GetMapping("/internal/health")
  public HealthResponse health() {
    return new HealthResponse(true, new HealthResponse.Data("ok"));
  }
}
