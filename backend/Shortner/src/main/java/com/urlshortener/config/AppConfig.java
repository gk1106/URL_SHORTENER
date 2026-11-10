package com.urlshortener.config;

import java.time.Clock;
import org.slf4j.MDC;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

@Configuration
public class AppConfig {
  @Bean
  Clock clock() {
    return Clock.systemUTC();
  }

  @Bean(name = "analyticsExecutor")
  ThreadPoolTaskExecutor analyticsExecutor() {
    ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
    executor.setCorePoolSize(2);
    executor.setMaxPoolSize(4);
    executor.setQueueCapacity(500);
    executor.setThreadNamePrefix("analytics-");
    executor.setWaitForTasksToCompleteOnShutdown(true);
    executor.setAwaitTerminationSeconds(20);
    executor.setTaskDecorator(
        task -> {
          var context = MDC.getCopyOfContextMap();
          return () -> {
            try {
              if (context != null) MDC.setContextMap(context);
              task.run();
            } finally {
              MDC.clear();
            }
          };
        });
    return executor;
  }
}
