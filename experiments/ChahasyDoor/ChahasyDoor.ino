/*
MQTT node connected to a MF RC522

MQTT protocol:
subscriptions
<deviceid>/get    => list stored authorized Labels
example: device1/get
<deviceid>/put {"label":"<LABEL>","id":"<ID>"}  => store Label+ID in the list of authorized Labels
example: device1/put {"label":"label1","id":"0A0B0C0D"}
<deviceid>/del {"label":"<LABEL>"}  => remove Label from of the list of authorized Labels
example: device1/del {"label":"label1"}

publishes
<deviceid>/read/ok      ID read and successfully matched
<deviceid>/read/error   ID read and not successfully matched
<deviceid>/cmdout/ok    result of set/get commands
<deviceid>/cmdout/error result of set/get commands

 * Typical pin layout used:
 * -----------------------------------------------------------------------------------------
 *             MFRC522      Arduino       Arduino   Arduino    Arduino          Arduino
 *             Reader/PCD   Uno           Mega      Nano v3    Leonardo/Micro   Pro Micro
 * Signal      Pin          Pin           Pin       Pin        Pin              Pin
 * -----------------------------------------------------------------------------------------
 * RST/Reset   RST          9             5         D9         RESET/ICSP-5     RST
 * SPI SS      SDA(SS)      7             53        D10        10               10
 * SPI MOSI    MOSI         11 / ICSP-4   51        D11        ICSP-4           16
 * SPI MISO    MISO         12 / ICSP-1   50        D12        ICSP-1           14
 * SPI SCK     SCK          13 / ICSP-3   52        D13        ICSP-3           15



*/

#include <SPI.h>
#include <Ethernet.h>
#include <PubSubClient.h>
#include <EEPROM.h>
#include <ArduinoJson.h>
#include <MFRC522.h>

#include "Utils.h"
#include "TokenStore.h"





// Update these with values suitable for your network.
byte mac[]    = {  0xDE, 0xED, 0xBA, 0xFE, 0xFE, 0xED };
byte server[] = {  169, 254, 192, 21 };
byte ip[]     = { 169, 254, 192, 122 };
// unique name of the device
String deviceid = "device1";

#define MAX_MSG_SIZE 50
#define CMD_RESULT true
#define READ_RESULT false

#define SS_PIN 7 // 10 is already used by the ethernet shield !
#define RST_PIN 9
MFRC522 mfrc522(SS_PIN, RST_PIN);        // Create MFRC522 instance.
MFRC522::MIFARE_Key key;

void callback(char* topic, byte* payload, unsigned int length);

EthernetClient ethClient;
PubSubClient client(server, 1883, callback, ethClient);
TokenStore tokenStore;



void report(bool tpc, bool ok, String message) {
  String topic = deviceid;
  // add the right topic
  if (tpc == CMD_RESULT) {
    topic = topic + String("/cmdout");
  }
  else {
    topic = topic + String("/read");
  }
  // and succes or failure
  if (ok) {
    topic = topic + String("/ok");
  }
  else {
    topic =  topic + String("/error");
  }
  // convert to char array
  int tlen = topic.length() + 1;
  char topicBuf[tlen];
  topic.toCharArray(topicBuf, tlen);
  int mlen = message.length() + 1;
  char messageBuf[mlen];
  message.toCharArray(messageBuf, mlen);
  // and publish message
  client.publish(topicBuf, messageBuf);
}


void doSubscribe(char *topic) {
  // add the topic
  String subscription = deviceid + String(topic);
  // convert to char array
  int len = subscription.length() + 1;
  char buf[len];
  subscription.toCharArray(buf, len);
  // and subscribe to topic
  client.subscribe(buf);
}

// parse Hex digit, e.g. 'A' becomes 10
byte fromHex(char c)
{
  if (c >= '0' && c <= '9')
    return (byte)(c - '0');
  else
    return (byte)(c - 'A' + 10);
}


// parse hex , e.g. "A1" becomes 161
boolean parseHexId(const char* data, byte id[]) {
  byte idx = 0;

  for ( int i = 0 ; i < TOKENIDSIZE ; i++ ) {
    if (data[idx] != '\0' && data[idx + 1] != '\0') {
      id[i] = ((fromHex(data[idx]) << 4) + fromHex(data[idx + 1]));
      idx += 2;
    }
    else {
      return (NOTOK);
    }
  }
  return (OK);
}

boolean parseJson(byte* payload, unsigned int length, char* label , byte id[], boolean needLabel, boolean needId) {
  StaticJsonBuffer<MAX_MSG_SIZE> jsonBuffer;
  char json[MAX_MSG_SIZE];

  if (length >= MAX_MSG_SIZE) {
    report(CMD_RESULT, NOTOK, F("Message too long"));
    return (NOTOK);
  }

  memcpy(json, payload, length);
  json[length] = '\0'; // ensure json string terminates
  JsonObject& root = jsonBuffer.parseObject(json);
  if (!root.success()) {
    //Serial.println("parseObject() failed");
    report(CMD_RESULT, NOTOK, F("Invalid JSON data"));
    return (NOTOK);
  }
  if (needLabel == OK) {
    if (root.containsKey("label")) {
      strncpy(label, root["label"], TOKENLABELSIZE);
      label[TOKENLABELSIZE] = '\0';
    }
    else {
      report(CMD_RESULT, NOTOK, F("Missing \"label\" parameter"));
      return (NOTOK);
    }
  }
  if (needId == OK) {
    if (root.containsKey("id")) {
      if (! parseHexId(root["id"], id)) {
        report(CMD_RESULT, NOTOK, F("Incorrect length of \"id\" parameter"));
        return (NOTOK);
      }
    }
    else {
      report(CMD_RESULT, NOTOK, F("Missing \"id\" parameter"));
      return (NOTOK);
    }
  }
  return (OK);
}


void callback(char* topic, byte* payload, unsigned int length) {
  String result;

  char label[TOKENLABELSIZE];
  byte id[TOKENIDSIZE];

  // handle message arrived
  String topicStr = String(topic);
  topicStr.replace((deviceid + "/"), ""); // e.g. device1/get -> get  and device1/put -> put
  String op = topicStr.substring(0, 3);
  Serial.print(F("Received a "));
  Serial.print(op);
  Serial.println(F(" cmd"));

  if (op.equals("get")) {
    // list records in eeprom
    tokenStore.list(result);
    report(CMD_RESULT, OK, result);
    return;
  }

  if (op.equals("put")) {
    if (parseJson(payload, length, label, id, OK, OK) == NOTOK) {
      return;
    }
    // add record to eeprom
    if (tokenStore.add(label, id) == OK) {
      report(CMD_RESULT, OK, F("Label added to store"));
    }
    else {
      report(CMD_RESULT, NOTOK, F("Failed to add label to store"));
    }
    return;
  }


  if (op.equals("del")) {
    if (parseJson(payload, length, label, id, OK, NOTOK) == NOTOK) {
      return;
    }
    // remove record from eeprom
    if (tokenStore.remove(label) == OK) {
      report(CMD_RESULT, OK, F("Label removed from store"));
    }
    else {
      report(CMD_RESULT, NOTOK, F("Failed to remove label from store"));
    }
    return;
  }

  //check if ID matches, for test only, not to be used in prod !!
  if (op.equals("tst")) {
    if (parseJson(payload, length, label, id, NOTOK, OK) == NOTOK) {
      return;
    }
    if (tokenStore.match(id, result) == OK) {
      report(CMD_RESULT, OK, result);
    }
    else {
      report(CMD_RESULT, NOTOK, F("Failed to match ID"));
    }
    return;
  }

}

void rc522Loop() {
  String result;
  if ( ! mfrc522.PICC_IsNewCardPresent())
    return;

  // Select one of the cards in the neighborhood of the reader
  if ( ! mfrc522.PICC_ReadCardSerial())
    return;

  // Show some details of the PICC (that is: the tag/card)
  Serial.print(F("Read card UID:"));
  for (int i = 0; i < TOKENIDSIZE; i++) {
    Serial.print(mfrc522.uid.uidByte[i], HEX);
  }
  Serial.println();
  // check if the uid is known in the tokenstore
  if (tokenStore.match(mfrc522.uid.uidByte, result) == OK) {
    report(READ_RESULT, OK, result);
  }
  else {
    report(READ_RESULT, NOTOK, F("Unknown ID"));
  }

  // Halt PICC
  mfrc522.PICC_HaltA();
  // Stop encryption on PCD
  mfrc522.PCD_StopCrypto1();

}

void setup()
{
  Serial.begin(9600);
  Serial.println(F("Initializing SPI"));
  SPI.begin();      // Init SPI bus
  Serial.println(F("Initializing mfrc522"));
  mfrc522.PCD_Init();   // Init MFRC522
  Serial.println(F("Initializing token store"));
  tokenStore.begin();
  Serial.println(F("Starting MQTT"));
  Ethernet.begin(mac, ip);
  if (client.connect("arduinoClient")) {
    Serial.println(F("MQTT started"));
    doSubscribe("/get");
    doSubscribe("/put");
    doSubscribe("/del");
    //check via MQTT if ID matches, for test only, not to be used in prod !!
    //doSubscribe("/tst");
  }

}

void loop()
{
  client.loop();
  rc522Loop();
}

