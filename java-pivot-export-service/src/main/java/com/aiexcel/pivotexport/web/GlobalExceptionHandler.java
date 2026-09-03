package com.aiexcel.pivotexport.web;

import com.aiexcel.pivotexport.model.ApiErrorResponse;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class GlobalExceptionHandler {

  @ExceptionHandler(PivotExportException.class)
  public ResponseEntity<ApiErrorResponse> handlePivotExportException(
      PivotExportException exception,
      HttpServletRequest request
  ) {
    return ResponseEntity.status(exception.status()).body(
        new ApiErrorResponse(
            false,
            request.getHeader("X-Request-Id"),
            new ApiErrorResponse.ErrorDetail(exception.code(), exception.getMessage())
        )
    );
  }

  @ExceptionHandler(MethodArgumentNotValidException.class)
  public ResponseEntity<ApiErrorResponse> handleValidationException(
      MethodArgumentNotValidException exception,
      HttpServletRequest request
  ) {
    FieldError fieldError = exception.getBindingResult().getFieldErrors().stream().findFirst().orElse(null);
    String message = fieldError == null
        ? "Request validation failed."
        : fieldError.getField() + " " + fieldError.getDefaultMessage();
    return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(
        new ApiErrorResponse(
            false,
            request.getHeader("X-Request-Id"),
            new ApiErrorResponse.ErrorDetail("INVALID_ARGUMENT", message)
        )
    );
  }

  @ExceptionHandler(Exception.class)
  public ResponseEntity<ApiErrorResponse> handleGenericException(HttpServletRequest request) {
    return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(
        new ApiErrorResponse(
            false,
            request.getHeader("X-Request-Id"),
            new ApiErrorResponse.ErrorDetail("INTERNAL_ERROR", "Internal server error.")
        )
    );
  }
}
