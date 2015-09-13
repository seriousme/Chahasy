#include "TokenStore.h"



void TokenStore::begin() {
  byte value =  EEPROM.read(0);

  if (value != TOKENSTOREVERSION) {
    // (re)init: create empty token
    AccessToken emptyToken = { INACTIVE, "Empty", {0,0,0,0}};
    // fill the token store with empty tokens
    for ( int index = 0 ; index < MAXTOKENS ; index++ ) {
      int address = TOKENBASE + index * sizeof(AccessToken);
      EEPROM.put(address, emptyToken);
    }
    EEPROM.write(0, TOKENSTOREVERSION);
  }
}

void TokenStore::list(String & tokenList) {
  // list the labels of all active tokens
  AccessToken token;
  int cnt = 0; // how many active tokens did we see
  tokenList = "{ \"tokens\": [";
  for ( int index = 0 ; index < MAXTOKENS ; index++ ) {
    int address = TOKENBASE + index * sizeof(AccessToken);
    EEPROM.get(address, token);
    if (token.active == ACTIVE ) {
      if (cnt > 0) {
        tokenList += ",";
      }
      tokenList = tokenList + '"' + String(token.label) + '"';
      cnt++;
    }
  }
  tokenList += "]}";
}

boolean TokenStore::add(const char* label, byte* id) {
  // find the first free slot and add the token

  AccessToken token;
  AccessToken tokenToStore;

  // copy data into struct
  tokenToStore.active = ACTIVE;
  // make sure parameter fits in available space

  strcpy(tokenToStore.label, label);
  memcpy(tokenToStore.id, id, TOKENIDSIZE);
  // find an empty slot
  for ( int index = 0 ; index < MAXTOKENS ; index++ ) {
    int address = TOKENBASE + index * sizeof(AccessToken);
    EEPROM.get(address, token);
    if (token.active == INACTIVE) { // we got an empty slot
      EEPROM.put(address, tokenToStore);
      return OK;
    }
  }
  // found no free slot
  return NOTOK;
}

boolean TokenStore::remove(const char* label) {
  // remove the token with the given label from the list
  AccessToken token;
  for ( int index = 0 ; index < MAXTOKENS ; index++ ) {
    int address = TOKENBASE + index * sizeof(AccessToken);
    EEPROM.get(address, token);
    if (token.active == ACTIVE) {
      if (strcmp(label, token.label) == 0) { // we got the token we were looking for
        token.active = INACTIVE;
        EEPROM.put(address, token);
        return OK;
      }
    }
  }
  // if we get here the token was not found
  return NOTOK;
}

boolean TokenStore::match(byte* id, String & result) {
  // check if a token with the given ID is present in the store
  AccessToken token;
  for ( int index = 0 ; index < MAXTOKENS ; index++ ) {
    int address = TOKENBASE + index * sizeof(AccessToken);
    EEPROM.get(address, token);
    if (token.active == ACTIVE) {
      if (memcmp(token.id, id, TOKENIDSIZE) == 0) { // we got the token we were looking for
        result = "{\"label\":\"" + String(token.label) + "\"}";
        return OK;
      }
    }
  }
  // if we get here the token was not found
  return NOTOK;
}

