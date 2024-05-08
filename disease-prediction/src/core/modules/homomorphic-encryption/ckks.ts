import { BatchEncoder } from 'node-seal/implementation/batch-encoder';
import { CipherText } from 'node-seal/implementation/cipher-text';
import { CKKSEncoder } from 'node-seal/implementation/ckks-encoder';
import { Context } from 'node-seal/implementation/context';
import { Decryptor } from 'node-seal/implementation/decryptor';
import { EncryptionParameters } from 'node-seal/implementation/encryption-parameters';
import { Encryptor } from 'node-seal/implementation/encryptor';
import { Evaluator } from 'node-seal/implementation/evaluator';
import { GaloisKeys } from 'node-seal/implementation/galois-keys';
import { KeyGenerator } from 'node-seal/implementation/key-generator';
import { PublicKey } from 'node-seal/implementation/public-key';
import { RelinKeys } from 'node-seal/implementation/relin-keys';
import { SEALLibrary } from 'node-seal/implementation/seal';
import { SecretKey } from 'node-seal/implementation/secret-key';


export class CKKSSealBuilder {
    private _polyModulusDegree: number;
    private _precision: number;
    private _scale: number;
    private _serializedPublicKey: string | null;
    private _serializedGaloisKey: string | null;
    private _serializedRelinKeys: string | null;

    constructor() {
        this._polyModulusDegree = 13;
        this._precision = 23;
        this._scale = Math.pow(2.0, this._precision);
        this._serializedPublicKey = null;
        this._serializedGaloisKey = null;
        this._serializedRelinKeys = null;
    }

    setPolyModulusDegree(polyModulusDegree: number, precision: number): CKKSSealBuilder {
        this._polyModulusDegree = polyModulusDegree;
        this._precision = precision;
        this._scale = Math.pow(2.0, this._precision);
        return this;
    }

    deserializePublicKey(serializedPublicKey: string): CKKSSealBuilder {
        this._serializedPublicKey = serializedPublicKey;
        return this;
    }

    deserializeGaloisKey(serializedGaloisKey: string): CKKSSealBuilder {
        this._serializedGaloisKey = serializedGaloisKey;
        return this;
    }

    deserializeRelinKeys(serializedRelinKeys: string): CKKSSealBuilder {
        this._serializedRelinKeys = serializedRelinKeys;
        return this;
    }

    build(seal: SEALLibrary) {
        const schemeType = seal.SchemeType.ckks;
        const securityLevel = seal.SecurityLevel.tc128;
        const polyModulusDegree = 4096
        const bitSizes = Int32Array.from([46, 16, 46])
        const coeffModulus = seal.CoeffModulus.Create(polyModulusDegree, bitSizes)
        //const polyModulusDegree = Math.pow(2, this._polyModulusDegree);
        //const coeffModulus = seal.CoeffModulus.Create(polyModulusDegree, Int32Array.from([40, 40, 40, 40, 40]));
        //const bitSizes = Math.floor(seal.CoeffModulus.MaxBitCount(polyModulusDegree, securityLevel) / this._precision);
        //const coeffModulus = seal.CoeffModulus.Create(polyModulusDegree, Int32Array.from(Array.from({ length: bitSizes }, () => this._precision)));

        const contextParms = seal.EncryptionParameters(schemeType);
        contextParms.setPolyModulusDegree(polyModulusDegree);
        contextParms.setCoeffModulus(coeffModulus);
        // this._serializedContextParms && contextParms.load(this._serializedContextParms);

        try {
            const context = seal.Context(contextParms, true, securityLevel);

            const keyGenerator = seal.KeyGenerator(context);
            const publicKey = keyGenerator.createPublicKey();
            const secretKey = keyGenerator.secretKey();
            const relinKeys = keyGenerator.createRelinKeys();
            const galoisKey = keyGenerator.createGaloisKeys();

            this._serializedPublicKey && publicKey.load(context, this._serializedPublicKey);
            this._serializedRelinKeys && relinKeys.load(context, this._serializedRelinKeys);
            this._serializedGaloisKey && galoisKey.load(context, this._serializedGaloisKey);

            const encryptor = seal.Encryptor(context, publicKey);
            const decryptor = seal.Decryptor(context, secretKey);
            const evaluator = seal.Evaluator(context);
            const encoder = seal.CKKSEncoder(context);

            return new CKKSSeal(seal, context, encoder, keyGenerator, publicKey, secretKey, galoisKey, relinKeys, encryptor, decryptor, evaluator, this._scale);
        }
        catch (e) {
            throw e;
        }
    }
}


export class CKKSSeal {
    private _seal: SEALLibrary;
    private _context: Context;
    private _encoder: CKKSEncoder;
    private _keyGenerator: KeyGenerator;
    private _publicKey: PublicKey;
    private _secretKey: SecretKey;
    private _galoisKey: GaloisKeys;
    private _relinKeys: RelinKeys;
    private _encryptor: Encryptor;
    private _decryptor: Decryptor;
    private _evaluator: Evaluator;
    private _scale: number;

    constructor(
        seal: SEALLibrary,
        context: Context,
        encoder: CKKSEncoder,
        keyGenerator: KeyGenerator,
        publicKey: PublicKey,
        secretKey: SecretKey,
        galoisKey: GaloisKeys,
        relinKeys: RelinKeys,
        encryptor: Encryptor,
        decryptor: Decryptor,
        evaluator: Evaluator,
        scale: number
    ) {
        this._seal = seal;
        this._context = context;
        this._encoder = encoder;
        this._keyGenerator = keyGenerator;
        this._publicKey = publicKey;
        this._secretKey = secretKey;
        this._galoisKey = galoisKey;
        this._relinKeys = relinKeys;
        this._encryptor = encryptor;
        this._decryptor = decryptor;
        this._evaluator = evaluator;
        this._scale = scale;
    }

    serializePublicKey(): string {
        return this._publicKey.save();
    }

    serializeGaloisKey(): string {
        return this._galoisKey.save();
    }

    serializeRelinKeys(): string {
        return this._relinKeys.save();
    }

    serializeCipherText(cipherText: CipherText): string {
        return cipherText.save();
    }

    deserializeCipherText(serializedCipherText: string): CipherText {
        const cipherText = this._seal.CipherText();
        cipherText.load(this._context, serializedCipherText);
        return cipherText;
    }

    encrypt(array: number[]): CipherText {
        const plainText = this._seal.PlainText();
        const cipherText = this._seal.CipherText();
        this._encoder.encode(Float64Array.from(array), this._scale, plainText);
        this._encryptor.encrypt(plainText, cipherText);
        return cipherText;
    }

    decrypt(cipherText: CipherText): number[] {
        const plainText = this._seal.PlainText();
        this._decryptor.decrypt(cipherText, plainText);
        const decoded = this._encoder.decode(plainText);
        return Array.from(decoded);
    }

    rotate(cipherText: CipherText, steps: number): CipherText {
        this._evaluator.rotateVector(cipherText, -steps, this._galoisKey, cipherText);
        return cipherText;
    }

    sum(cipherText: CipherText): CipherText {
        const result = this._seal.CipherText();
        this._evaluator.sumElements(cipherText, this._galoisKey, this._seal.SchemeType.ckks, result);
        return result;
    }

    add(cipherText1: CipherText, cipherText2: CipherText): CipherText {
        const result = this._seal.CipherText();
        this._evaluator.add(cipherText1, cipherText2, result);
        return result;
    }

    subtract(cipherText1: CipherText, cipherText2: CipherText): CipherText {
        const result = this._seal.CipherText();
        this._evaluator.sub(cipherText1, cipherText2, result);
        return result;
    }

    multiply(cipherText1: CipherText, cipherText2: CipherText): CipherText {
        const result = this._seal.CipherText();
        this._evaluator.multiply(cipherText1, cipherText2, result);
        this._evaluator.relinearize(result, this._relinKeys, result);
        return result;
    }

    negate(cipherText: CipherText): CipherText {
        const result = this._seal.CipherText();
        this._evaluator.negate(cipherText, result);
        return result;
    }
}