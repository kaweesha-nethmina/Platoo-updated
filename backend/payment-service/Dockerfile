FROM eclipse-temurin:20-jdk

ARG JAR_FILE=target/stripe-payment-0.0.1-SNAPSHOT.jar

COPY ${JAR_FILE} app.jar

EXPOSE 8081

ENTRYPOINT ["java", "-jar", "/app.jar"]
