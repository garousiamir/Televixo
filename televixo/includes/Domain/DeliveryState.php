<?php
/**
 * Delivery state of a message towards the other side.
 *
 * local_accepted     – stored in WordPress; nothing sent yet
 * queued             – an outbox job exists
 * provider_accepted  – Telegram returned ok:true for every part. This is NOT
 *                      proof that a person read it.
 * partially_sent     – some parts accepted, the rest pending retry
 * uncertain          – the request may or may not have reached Telegram
 *                      (timeout); held for review to avoid blind duplicates
 * failed             – permanent failure or retries exhausted
 * not_applicable     – nothing to deliver (operator replies, notes, spam)
 *
 * Website read state is tracked separately with read markers.
 *
 * @package Televixo
 */

namespace Televixo\Domain;

defined( 'ABSPATH' ) || exit;

enum DeliveryState: string {
	case LocalAccepted    = 'local_accepted';
	case Queued           = 'queued';
	case ProviderAccepted = 'provider_accepted';
	case PartiallySent    = 'partially_sent';
	case Uncertain        = 'uncertain';
	case Failed           = 'failed';
	case NotApplicable    = 'not_applicable';
}
