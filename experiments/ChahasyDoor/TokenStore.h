#ifndef TokenStore_h
#define TokenStore_h

#include <Arduino.h>
#include <EEPROM.h>
#include "Utils.h"

// version of the tokenStore, stored at address 0 of the EEPROM
// change this if you need the EEPROM reinitialized at reboot
#define TOKENSTOREVERSION 3
// where does the token list start in eeprom
#define TOKENBASE 16

// the maximum number of tokens supported
#define MAXTOKENS 10

#define ACTIVE 1
#define INACTIVE 0
#define TOKENIDSIZE 4 // PICC UID  is 4 bytes
#define TOKENLABELSIZE 11

struct AccessToken {
  byte active;
  char label[TOKENLABELSIZE];
  byte id[TOKENIDSIZE];
};




class TokenStore
{
  public:
    void begin();
    void list(String & tokenList);
    boolean add(const char* label, byte* id);
    boolean remove(const char* label);
    boolean match(byte* id, String & label);
};


#endif
