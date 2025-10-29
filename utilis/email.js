const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransporter({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  }

  async sendReservationConfirmation(email, reservation, item) {
    const confirmationUrl = `${process.env.BASE_URL || 'http://localhost:3000'}/reservations/confirm/${reservation.confirmationToken}`;
    
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Confirmation de réservation - GiftList',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #3498db;">Confirmation de Réservation</h2>
          <p>Vous avez réservé l'article suivant :</p>
          <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0;">
            <h3>${item.name}</h3>
            <p>Quantité: ${reservation.quantity}</p>
            ${item.price ? `<p>Prix unitaire: ${new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(item.price)}</p>` : ''}
          </div>
          <p>Pour confirmer définitivement votre réservation, veuillez cliquer sur le lien ci-dessous :</p>
          <a href="${confirmationUrl}" style="display: inline-block; background: #3498db; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin: 10px 0;">
            Confirmer ma réservation
          </a>
          <p><em>Ce lien expirera le ${new Date(reservation.expiresAt).toLocaleDateString('fr-FR')}</em></p>
          <p>Si vous n'avez pas fait cette réservation, vous pouvez ignorer cet email.</p>
        </div>
      `
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log('Email de confirmation envoyé à:', email);
      return true;
    } catch (error) {
      console.error('Erreur envoi email:', error);
      return false;
    }
  }

  async sendReservationNotification(listCreatorEmail, item, reservedBy) {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: listCreatorEmail,
      subject: 'Nouvelle réservation sur votre liste - GiftList',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2ecc71;">Nouvelle Réservation !</h2>
          <p>Quelqu'un a réservé un article sur votre liste :</p>
          <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0;">
            <h3>${item.name}</h3>
            <p>La surprise est préservée ! 🎁</p>
          </div>
          <p>Connectez-vous à votre espace pour voir les détails.</p>
        </div>
      `
    };

    try {
      await this.transporter.sendMail(mailOptions);
      return true;
    } catch (error) {
      console.error('Erreur envoi notification:', error);
      return false;
    }
  }
}

module.exports = new EmailService();