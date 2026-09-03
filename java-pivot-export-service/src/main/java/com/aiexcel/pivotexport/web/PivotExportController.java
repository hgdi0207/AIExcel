package com.aiexcel.pivotexport.web;

import com.aiexcel.pivotexport.model.PivotExportRequest;
import com.aiexcel.pivotexport.model.PivotExportResponse;
import com.aiexcel.pivotexport.service.PivotExportService;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class PivotExportController {

  private final InternalRequestAuthService internalRequestAuthService;
  private final PivotExportService pivotExportService;

  public PivotExportController(
      InternalRequestAuthService internalRequestAuthService,
      PivotExportService pivotExportService
  ) {
    this.internalRequestAuthService = internalRequestAuthService;
    this.pivotExportService = pivotExportService;
  }

  @PostMapping("/internal/pivot/export")
  public PivotExportResponse export(
      @RequestHeader(name = "X-Internal-Token", required = false) String internalToken,
      @RequestHeader(name = "X-Request-Id", required = false) String requestId,
      @Valid @RequestBody PivotExportRequest request
  ) {
    internalRequestAuthService.validateInternalToken(internalToken);
    String resolvedRequestId = requestId == null || requestId.isBlank() ? UUID.randomUUID().toString() : requestId;
    PivotExportResponse.Data data = pivotExportService.export(request);
    return new PivotExportResponse(true, resolvedRequestId, data);
  }
}
