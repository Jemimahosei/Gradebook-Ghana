package com.gradebook.config;

import com.zaxxer.hikari.HikariDataSource;
import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import javax.sql.DataSource;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

/**
 * Render deploy support: Render injects the Postgres connection string as
 * {@code DATABASE_URL} in {@code postgres://user:pass@host:port/db} form,
 * which is not a JDBC URL. When (and only when) that variable is present,
 * this config builds the DataSource from it, converting to
 * {@code jdbc:postgresql://host:port/db?sslmode=require}. With no
 * {@code DATABASE_URL} set (local Mac run, VM H2 run) this config is
 * inactive and the {@code spring.datasource.*} properties apply instead.
 */
@Configuration
@ConditionalOnProperty(name = "DATABASE_URL")
public class RenderDatabaseConfig {

    @Bean
    @Primary
    public DataSource dataSource() {
        String databaseUrl = System.getenv("DATABASE_URL");
        try {
            URI uri = new URI(databaseUrl);
            String userInfo = uri.getUserInfo();
            String username = null;
            String password = null;
            if (userInfo != null) {
                String[] parts = userInfo.split(":", 2);
                username = URLDecoder.decode(parts[0], StandardCharsets.UTF_8);
                if (parts.length > 1) {
                    password = URLDecoder.decode(parts[1], StandardCharsets.UTF_8);
                }
            }
            int port = uri.getPort() == -1 ? 5432 : uri.getPort();
            String jdbcUrl = "jdbc:postgresql://" + uri.getHost() + ":" + port
                    + uri.getPath() + "?sslmode=require";
            HikariDataSource ds = new HikariDataSource();
            ds.setJdbcUrl(jdbcUrl);
            ds.setUsername(username);
            ds.setPassword(password);
            return ds;
        } catch (Exception e) {
            throw new IllegalStateException("Could not parse DATABASE_URL", e);
        }
    }
}
