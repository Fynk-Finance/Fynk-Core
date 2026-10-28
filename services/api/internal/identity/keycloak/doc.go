// Package keycloak is M1's Keycloak code. Today it holds the tests of the fynk realm defined
// in services/keycloak/realms/fynk-realm.json (realm_test.go without Docker, and
// realm_integration_test.go against a real Keycloak with -tags integration). The admin API
// client of the backend lands here with the profile and devices endpoints.
package keycloak
