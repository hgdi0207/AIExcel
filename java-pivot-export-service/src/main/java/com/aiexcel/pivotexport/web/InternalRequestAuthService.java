package com.aiexcel.pivotexport.web;

import com.aiexcel.pivotexport.config.PivotExportProperties;
import org.springframework.stereotype.Service;

@Service
public class InternalRequestAuthService {

  private final PivotExportProperties properties;

  public InternalRequestAuthService(PivotExportProperties properties) {
    this.properties = properties;
  }

  public void validateInternalToken(String token) {
    String expected = properties.getSharedToken();
    if (expected == null || expected.isBlank() || !expected.equals(token)) {
      throw PivotExportException.unauthorized("UNAUTHORIZED", "Internal token is invalid.");
    }
  }
}
