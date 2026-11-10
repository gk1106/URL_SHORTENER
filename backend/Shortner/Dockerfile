FROM maven:3.9-eclipse-temurin-26 AS build
WORKDIR /workspace
COPY pom.xml .
RUN mvn -B dependency:go-offline
COPY src src
RUN mvn -B verify

FROM eclipse-temurin:17-jre-jammy
RUN groupadd --system shortener && useradd --system --gid shortener --home-dir /app shortener
WORKDIR /app
COPY --from=build --chown=shortener:shortener /workspace/target/shortener-0.0.1-SNAPSHOT.jar app.jar
USER shortener
EXPOSE 8080
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75.0", "-jar", "app.jar"]
