package privacy

import (
	"crypto/sha256"
	"encoding/hex"
	"strings"
	"time"

	httpapi "github.com/Fynk-Finance/Fynk-Core/services/api/internal/privacy/http"
)

// PolicyVersion is the current active policy version string.
const PolicyVersion = "2026-11-v1"

// PolicyDataController is the legal entity responsible for personal data treatment.
const PolicyDataController = "Fynk Finance S.A.S."

// PolicyContactEmail is the official channel for queries, claims, and data subject rights.
const PolicyContactEmail = "privacidad@fynk.com.co"

// QueryResponseDays is the response term for queries under Ley 1581 de 2012 (art. 14: 10 días hábiles).
const QueryResponseDays = 10

// ClaimResponseDays is the response term for claims under Ley 1581 de 2012 (art. 15: 15 días hábiles).
const ClaimResponseDays = 15

// PolicyPublishedAt is the timestamp when this version was published.
var PolicyPublishedAt = time.Date(2026, time.November, 1, 0, 0, 0, 0, time.UTC)

// PolicyMarkdown is the official Spanish (Colombia) policy text complying with Ley 1581 de 2012.
//
//nolint:misspell // Spanish copy complying with Ley 1581
const PolicyMarkdown = `# Política de Tratamiento de Datos Personales de Fynk

**Versión:** 2026-11-v1  
**Fecha de entrada en vigencia:** 1 de noviembre de 2026  

## 1. Responsable del Tratamiento
**Fynk Finance S.A.S.** (en adelante "Fynk"), sociedad legalmente constituida en Colombia, actúa como Responsable del Tratamiento de tus datos personales conforme a la Ley Estatutaria 1581 de 2012 y el Decreto 1377 de 2013.

* **Correo electrónico de contacto:** privacidad@fynk.com.co  
* **Canal de atención para el ejercicio de derechos de Habeas Data:** privacidad@fynk.com.co  

## 2. Finalidades del Tratamiento
Tratamos tus datos exclusivamente para finalidades legítimas y explícitas:

1. **Gestión de finanzas personales:** Permitirte consultar y consolidar en una sola aplicación tus saldos y movimientos de cuentas bancarias autorizadas, organizar presupuestos, categorizar ingresos y gastos, y hacer seguimiento a tus metas de ahorro.
2. **Recomendaciones informativas:** Brindarte sugerencias orientadas a optimizar tus hábitos financieros y alertarte sobre aumentos en suscripciones. Cuando interviene inteligencia artificial, utilizamos únicamente agregados numéricos en tránsito, que no se almacenan y que impiden cualquier identificación personal.
3. **Seguridad y prevención del fraude:** Validar tu identidad al acceder a la aplicación, verificar la autenticidad de tus dispositivos registrados, prevenir accesos no autorizados y conservar un registro de auditoría inmutable de eventos de acceso y autorizaciones.

## 3. Categorías de Datos y Dónde Reside Cada Una
En cumplimiento de nuestro principio de arquitectura de conocimiento cero (Zero-Knowledge) y minimización de datos:

* **Datos de cuenta y acceso (correo electrónico, nombre, sesiones activas):** Residen en la nube en nuestro servicio de autenticación (Keycloak), protegidos mediante cifrado y algoritmos robustos de derivación de claves.
* **Dispositivos vinculados:** Se almacenan en la nube únicamente con su identificador y su llave pública criptográfica, sin claves privadas.
* **Consentimientos Open Finance y evidencia de aceptación:** Se guardan en la nube en texto auditable para garantizar la trazabilidad exigida por la Superintendencia Financiera de Colombia (Circular Externa 004 de 2024).
* **Vínculos bancarios:** Se registran en la nube únicamente con una huella criptográfica (HMAC) para asociar el vínculo a tu dispositivo móvil. Los tokens de acceso bancario nunca se guardan en la nube.
* **Cuentas, saldos y movimientos bancarios:** Residen **exclusivamente en la bóveda cifrada de tu teléfono celular**. Fynk no guarda tus extractos, números completos de cuenta ni saldos en sus servidores.
* **Metas de ahorro, gastos fijos y suscripciones:** Se guardan en la bóveda de tu teléfono y cuentan con una copia de seguridad en la nube que está cifrada de extremo a extremo; Fynk no tiene la clave para descifrarla.
* **Registros de auditoría:** Se preservan en una cadena inmutable e infalsificable de eventos (inicio de sesión, cambio de clave, autorizaciones) que nunca contiene correos electrónicos, contraseñas, tokens ni montos de dinero.

## 4. Derechos de los Titulares (Ley 1581 de 2012)
Como titular de datos personales, tienes derecho a:

1. **Conocer, actualizar y rectificar** tus datos personales frente a Fynk en cualquier momento.
2. **Solicitar prueba** de la autorización otorgada para el tratamiento de tus datos.
3. **Ser informado**, previa solicitud, sobre el uso que Fynk le ha dado a tus datos personales.
4. **Revocar la autorización y/o solicitar la supresión** de tus datos cuando en el tratamiento no se respeten los principios, derechos y garantías constitucionales y legales, o a través del mecanismo de eliminación de cuenta disponible en la aplicación.
5. **Acceder en forma gratuita** a tus datos personales que hayan sido objeto de tratamiento (incluyendo la descarga completa de tu información mediante la opción "Descargar mis datos").
6. **Presentar quejas** ante la Superintendencia de Industria y Comercio (SIC) por infracciones a lo dispuesto en la Ley 1581 de 2012 y demás normas aplicables.

## 5. Canales de Atención y Tiempos de Respuesta
Puedes ejercer tus derechos enviando una solicitud a **privacidad@fynk.com.co** o desde la sección "Privacidad y datos" de la aplicación.

* **Consultas:** Serán atendidas en un término máximo de **diez (10) días hábiles** contados a partir de la fecha de su recibo. Si no fuere posible atender la consulta dentro de dicho término, se te informará antes del vencimiento indicando los motivos de la demora y la fecha en que se resolverá, la cual no superará los cinco (5) días hábiles siguientes al vencimiento del primer término.
* **Reclamos (Actualización, Rectificación o Supresión):** Serán atendidos en un término máximo de **quince (15) días hábiles** contados a partir del día siguiente a la fecha de su recibo. Si no fuere posible resolver el reclamo dentro de dicho término, se te informará antes del vencimiento indicando los motivos de la demora y la nueva fecha de resolución, la cual no superará los ocho (8) días hábiles siguientes al vencimiento del primer término.
`

// CurrentPolicy returns the active PrivacyPolicy representation.
func CurrentPolicy() httpapi.PrivacyPolicy {
	body := strings.TrimSpace(PolicyMarkdown)
	hash := sha256.Sum256([]byte(body))
	return httpapi.PrivacyPolicy{
		Version:           PolicyVersion,
		PublishedAt:       PolicyPublishedAt,
		Sha256:            hex.EncodeToString(hash[:]),
		BodyMd:            body,
		DataController:    PolicyDataController,
		ContactEmail:      PolicyContactEmail,
		QueryResponseDays: QueryResponseDays,
		ClaimResponseDays: ClaimResponseDays,
	}
}
