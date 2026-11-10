package com.urlshortener.service;

import com.urlshortener.dto.CreateLinkRequest;
import com.urlshortener.dto.LinkResponse;
import com.urlshortener.dto.LinkStatsResponse;
import com.urlshortener.dto.PageResponse;
import com.urlshortener.dto.UpdateLinkRequest;

/** Application operations used by controllers; persistence stays inside the implementation. */
public interface LinkService {
  LinkResponse create(CreateLinkRequest request, String owner);

  PageResponse<LinkResponse> list(String owner, int page, int size);

  LinkResponse get(String id, String owner);

  LinkResponse update(String id, String owner, UpdateLinkRequest request);

  LinkStatsResponse stats(String id, String owner);

  String resolve(String code);

  String resolve(String code, boolean countClick);
}
