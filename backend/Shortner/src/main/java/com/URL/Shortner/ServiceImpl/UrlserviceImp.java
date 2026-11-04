package com.URL.Shortner.ServiceImpl;

import org.springframework.stereotype.Service;

@Service
public class UrlserviceImp  implements URLService {

 public String generateShortUrl(String longUrl) {


    if(longUrl.isBlank() || longUrl.isEmpty()){
        return "Please provide a valid URL";
    }

    return "http://short.url/" + longUrl.hashCode();
    
 }

    

    
}
