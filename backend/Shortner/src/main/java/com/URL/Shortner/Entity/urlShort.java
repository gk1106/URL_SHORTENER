package com.URL.Shortner.Entity;

import java.sql.Timestamp;

import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "urlShort")
@Data
@NoArgsConstructor 
@AllArgsConstructor 
public class urlShort {

    private  long  id;

    private String ShortUrl;

    private String LongUrl;

    private Timestamp createdAt;

    private Timestamp updatedAt;

    private Timestamp expiredAt;

    private boolean isActive;

    private long ClickCount;








    
}
