// Host-compiled test for OTA signature verification stub.
// Compile and run with: g++ -std=c++17 -I src test/test_ota.cpp src/ota.cpp -o /tmp/test_ota && /tmp/test_ota
// This is NOT a PlatformIO test — it runs on the host to verify the OTA contract.

#include "ota.h"
#include <cstdio>
#include <cstring>

static int tests_run = 0;
static int tests_passed = 0;

#define ASSERT_TRUE(expr, msg) do { \
    tests_run++; \
    if (expr) { tests_passed++; } \
    else { printf("FAIL: %s\n", msg); } \
} while(0)

int main() {
    // Test key and signature (must match TEST_PUBLIC_KEY and TEST_SIGNATURE in ota.cpp)
    uint8_t testKey[32] = {
        0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
        0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f, 0x10,
        0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17, 0x18,
        0x19, 0x1a, 0x1b, 0x1c, 0x1d, 0x1e, 0x1f, 0x20,
    };
    uint8_t testSig[64] = {
        0xEF, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    };
    uint8_t firmware[] = {0x01, 0x02, 0x03, 0x04, 0x05};

    // Test 1: Correct signature passes
    ASSERT_TRUE(
        verifyUpdateSignature(firmware, sizeof(firmware), testSig, sizeof(testSig), testKey, sizeof(testKey)),
        "correct signature should pass"
    );

    // Test 2: Tampered signature fails
    uint8_t tamperedSig[64];
    memcpy(tamperedSig, testSig, 64);
    tamperedSig[1] = 0xFF;
    ASSERT_TRUE(
        !verifyUpdateSignature(firmware, sizeof(firmware), tamperedSig, sizeof(tamperedSig), testKey, sizeof(testKey)),
        "tampered signature should fail"
    );

    // Test 3: Truncated signature fails
    ASSERT_TRUE(
        !verifyUpdateSignature(firmware, sizeof(firmware), testSig, 32, testKey, sizeof(testKey)),
        "truncated signature should fail"
    );

    // Test 4: Null firmware fails
    ASSERT_TRUE(
        !verifyUpdateSignature(nullptr, 0, testSig, sizeof(testSig), testKey, sizeof(testKey)),
        "null firmware should fail"
    );

    // Test 5: Null signature fails
    ASSERT_TRUE(
        !verifyUpdateSignature(firmware, sizeof(firmware), nullptr, 0, testKey, sizeof(testKey)),
        "null signature should fail"
    );

    // Test 6: Wrong public key fails
    uint8_t wrongKey[32];
    memset(wrongKey, 0xAA, 32);
    ASSERT_TRUE(
        !verifyUpdateSignature(firmware, sizeof(firmware), testSig, sizeof(testSig), wrongKey, sizeof(wrongKey)),
        "wrong public key should fail"
    );

    // Test 7: Signature without magic prefix fails
    uint8_t noMagicSig[64];
    memset(noMagicSig, 0, 64);
    ASSERT_TRUE(
        !verifyUpdateSignature(firmware, sizeof(firmware), noMagicSig, sizeof(noMagicSig), testKey, sizeof(testKey)),
        "signature without magic prefix should fail"
    );

    printf("\nOTA verify tests: %d/%d passed\n", tests_passed, tests_run);
    return (tests_passed == tests_run) ? 0 : 1;
}