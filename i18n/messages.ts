import { defineGcsExtensionMessages } from '@gcs-ssc/extensions'

export const messages = defineGcsExtensionMessages({
  en: {
    toFrench: 'Translate to French', toEnglish: 'Translate to English', title: 'Machine translation',
    notice: 'This is a machine translation. Check that it is accurate before saving.',
    loading: 'Translating… The first translation may take longer while language models download.',
    overwrite: 'The other language field already contains text. Translate and replace it?',
    start: 'Translate and replace', cancel: 'Cancel', close: 'Close',
    failed: 'Translation failed. Try again, and check your connection if language models have not downloaded.',
    stale: 'The form changed during translation. Your text was preserved. Start the translation again.',
    done: 'Translation copied to the other language field. Please check it for accuracy.',
    glossary: 'Glossary', agencyHelp: 'Agency terms apply to all enabled translation fields in this agency.',
    streamHelp: 'Stream terms add to the agency glossary. A matching stream term takes precedence in the translation direction.',
    add: 'Add term', remove: 'Remove term {number}', english: 'English term', french: 'French term',
    empty: 'No glossary terms. Translation will use the language model’s vocabulary.',
    invalid: 'Enter both languages for every term (maximum 500 terms, 250 characters each). Terms must be unique in each language.',
    chooseAgency: 'Choose an agency glossary', agencyHelpTranslation: 'This Proponent is shared across agencies. Choose which agency glossary to use.'
  },
  fr: {
    toFrench: 'Traduire en français', toEnglish: 'Traduire en anglais', title: 'Traduction automatique',
    notice: 'Il s’agit d’une traduction automatique. Vérifiez son exactitude avant d’enregistrer.',
    loading: 'Traduction en cours… La première traduction peut prendre plus de temps pendant le téléchargement des modèles linguistiques.',
    overwrite: 'Le champ de l’autre langue contient déjà du texte. Le traduire et le remplacer?',
    start: 'Traduire et remplacer', cancel: 'Annuler', close: 'Fermer',
    failed: 'La traduction a échoué. Réessayez et vérifiez votre connexion si les modèles linguistiques ne sont pas téléchargés.',
    stale: 'Le formulaire a changé pendant la traduction. Votre texte a été conservé. Relancez la traduction.',
    done: 'La traduction a été copiée dans le champ de l’autre langue. Vérifiez son exactitude.',
    glossary: 'Glossaire', agencyHelp: 'Les termes de l’agence s’appliquent à tous ses champs de traduction activés.',
    streamHelp: 'Les termes du volet complètent le glossaire de l’agence. Un terme correspondant du volet a priorité dans le sens de traduction.',
    add: 'Ajouter un terme', remove: 'Supprimer le terme {number}', english: 'Terme anglais', french: 'Terme français',
    empty: 'Aucun terme dans le glossaire. La traduction utilisera le vocabulaire du modèle linguistique.',
    invalid: 'Saisissez les deux langues pour chaque terme (maximum de 500 termes de 250 caractères chacun). Les termes doivent être uniques dans chaque langue.',
    chooseAgency: 'Choisir un glossaire d’agence', agencyHelpTranslation: 'Ce promoteur est partagé entre les agences. Choisissez le glossaire d’agence à utiliser.'
  }
})
