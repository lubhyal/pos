-- --------------------------------------------------------
-- Host:                         192.168.1.77
-- Server version:               4.0.12-nt
-- Server OS:                    
-- HeidiSQL Version:             12.21.0.7344
-- --------------------------------------------------------

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET NAMES latin1 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;


-- Dumping database structure for cipta
CREATE DATABASE IF NOT EXISTS `cipta`;
USE `cipta`;

-- Dumping structure for table cipta.anggota
CREATE TABLE IF NOT EXISTS `anggota` (
  `KdAng` char(15) NOT NULL default '0',
  `NmAng` char(30) NOT NULL default '0',
  `AlAng` char(40) default NULL,
  `kota` char(15) default NULL,
  `Telp` char(15) default NULL,
  `CPerson` char(15) default NULL,
  `NPWP` char(20) default NULL,
  `Email` char(40) default NULL,
  `WPage` char(40) default NULL,
  `JTempo` decimal(3,0) default '0',
  `Disc` decimal(5,2) default '0.00',
  `Plafon` decimal(10,2) default '0.00',
  `PAwal` decimal(10,2) default '0.00',
  `Jual` decimal(10,2) default '0.00',
  `Retur` decimal(10,2) default '0.00',
  `Lunas` decimal(10,2) default '0.00',
  `GGantung` decimal(10,2) default '0.00',
  `Jakhir` char(10) default NULL,
  `BAWAL` decimal(10,2) NOT NULL default '0.00',
  `MASAAKTIF` char(1) default NULL,
  `TGL1` date default '0000-00-00',
  `TGL2` date default '0000-00-00',
  `DAFTAR` decimal(10,2) default '0.00',
  `IURAN` decimal(10,2) default '0.00',
  PRIMARY KEY  (`KdAng`),
  KEY `NmSupp` (`NmAng`)
) TYPE=MyISAM COMMENT='Master Data Anggota';

-- Data exporting was unselected.

-- Dumping structure for table cipta.beli
CREATE TABLE IF NOT EXISTS `beli` (
  `NoFak` varchar(10) NOT NULL default '',
  `TglFak` date default '0000-00-00',
  `Ket` varchar(40) default NULL,
  `Total` decimal(12,2) NOT NULL default '0.00',
  `Pot1` decimal(5,2) NOT NULL default '0.00',
  `PotRp1` decimal(12,2) NOT NULL default '0.00',
  `Pot2` decimal(5,2) NOT NULL default '0.00',
  `PotRp2` decimal(12,2) NOT NULL default '0.00',
  `PPNPersen` decimal(5,2) NOT NULL default '0.00',
  `PPNRp` decimal(12,2) NOT NULL default '0.00',
  `GTotal` decimal(12,2) NOT NULL default '0.00',
  `Bayar` decimal(12,2) NOT NULL default '0.00',
  `Pos` char(1) default 'N',
  `Lain` decimal(12,2) NOT NULL default '0.00',
  `KDSUPP` varchar(15) default NULL,
  PRIMARY KEY  (`NoFak`)
) TYPE=MyISAM;

-- Data exporting was unselected.

-- Dumping structure for table cipta.dbeli
CREATE TABLE IF NOT EXISTS `dbeli` (
  `NoFak` varchar(10) default '0',
  `TglFak` date default '0000-00-00',
  `KdBar` varchar(13) default '0',
  `barcode` varchar(15) NOT NULL default '',
  `NmBar` varchar(30) default '0',
  `Satuan` varchar(7) default '0',
  `Qty` decimal(7,3) default '0.000',
  `Qtyz` decimal(7,3) default '0.000',
  `Hbeli` decimal(12,2) default '0.00',
  `Disc` decimal(5,2) default '0.00',
  `Jumlah` decimal(12,2) default '0.00',
  KEY `NoFak` (`NoFak`)
) TYPE=MyISAM;

-- Data exporting was unselected.

-- Dumping structure for table cipta.djual
CREATE TABLE IF NOT EXISTS `djual` (
  `nofak` varchar(15) default '0',
  `TglFak` date default '0000-00-00',
  `KdKasir` varchar(5) default '0',
  `KdBar` varchar(13) default '0',
  `Barcode` varchar(15) default NULL,
  `NmBar` varchar(30) default '0',
  `Satuan` varchar(7) default '0',
  `Qty` decimal(7,3) default '0.000',
  `Qtyz` decimal(7,3) default '0.000',
  `Hbeli` decimal(12,2) default '0.00',
  `HPokok` decimal(12,2) default '0.00',
  `HJual` decimal(12,2) default '0.00',
  `HJualz` decimal(12,2) default '0.00',
  `Disc` decimal(5,2) default '0.00',
  `Ppn` decimal(5,2) default '0.00',
  `Jumlah` decimal(12,2) default '0.00',
  `KOND` char(1) default '1',
  `KDANG` varchar(15) default NULL,
  `Disc2` decimal(5,0) NOT NULL default '0',
  KEY `NoFak` (`TglFak`,`KdKasir`,`nofak`)
) TYPE=MyISAM;

-- Data exporting was unselected.

-- Dumping structure for table cipta.dpending
CREATE TABLE IF NOT EXISTS `dpending` (
  `nofak` varchar(15) default '0',
  `TglFak` date default '0000-00-00',
  `KdKasir` varchar(5) default '0',
  `KdBar` varchar(13) default '0',
  `Barcode` varchar(15) default NULL,
  `NmBar` varchar(30) default '0',
  `Satuan` varchar(7) default '0',
  `Qty` decimal(7,3) default '0.000',
  `Qtyz` decimal(7,3) default '0.000',
  `Hbeli` decimal(12,2) default '0.00',
  `HPokok` decimal(12,2) default '0.00',
  `HJual` decimal(12,2) default '0.00',
  `HJualz` decimal(12,2) default '0.00',
  `Disc` decimal(5,2) default '0.00',
  `Ppn` decimal(5,2) default '0.00',
  `Jumlah` decimal(12,2) default '0.00',
  `KdGudang` varchar(4) default '0',
  KEY `NoFak` (`TglFak`,`KdKasir`,`nofak`)
) TYPE=MyISAM;

-- Data exporting was unselected.

-- Dumping structure for table cipta.fakturis
CREATE TABLE IF NOT EXISTS `fakturis` (
  `Tipu` char(1) NOT NULL default 'Y',
  `FakBeli` varchar(10) default NULL,
  `FakPo` varchar(10) default NULL,
  `Fakjual` varchar(10) default NULL,
  `RetBeli` varchar(10) default NULL,
  `Fakpind` varchar(10) default NULL,
  `FakBpiut` varchar(10) default NULL,
  `FakBhut` varchar(10) default NULL,
  PRIMARY KEY  (`Tipu`)
) TYPE=MyISAM;

-- Data exporting was unselected.

-- Dumping structure for table cipta.jual
CREATE TABLE IF NOT EXISTS `jual` (
  `nofak` varchar(15) default '0',
  `tglfak` date default '0000-00-00',
  `kdkasir` varchar(5) default '0',
  `jam` time default '00:00:00',
  `total` decimal(12,2) default '0.00',
  `ppn` decimal(12,2) default '0.00',
  `Disc` decimal(5,2) default '0.00',
  `DiscRp` decimal(12,2) default '0.00',
  `GTotal` decimal(12,2) default '0.00',
  `KdCust` varchar(15) default NULL,
  `KOND` char(1) default '1',
  `KDANG` varchar(15) default NULL,
  KEY `nofak` (`tglfak`,`kdkasir`,`nofak`)
) TYPE=MyISAM;

-- Data exporting was unselected.

-- Dumping structure for table cipta.kakredit
CREATE TABLE IF NOT EXISTS `kakredit` (
  `nofak` int(5) default '0',
  `tglfak` date default '0000-00-00',
  `kdkasir` varchar(5) default '0',
  `GTotal` decimal(12,2) default '0.00',
  `BCARD` decimal(5,2) default '0.00',
  `Jenis` varchar(15) default NULL,
  `NAMA` varchar(20) default NULL,
  `NOMOR` varchar(20) default NULL,
  KEY `nofak` (`tglfak`,`kdkasir`,`nofak`)
) TYPE=MyISAM;

-- Data exporting was unselected.

-- Dumping structure for table cipta.kasjual
CREATE TABLE IF NOT EXISTS `kasjual` (
  `Tgl` date default '0000-00-00',
  `KdUser` varchar(5) default '0',
  `Awal` decimal(12,2) default '0.00',
  `Masuk` decimal(12,2) default '0.00',
  `Keluar` decimal(12,2) default '0.00',
  `Laci` int(5) default '0',
  `Batal` decimal(10,2) NOT NULL default '0.00',
  KEY `Tgl` (`Tgl`,`KdUser`)
) TYPE=MyISAM;

-- Data exporting was unselected.

-- Dumping structure for table cipta.kelompok
CREATE TABLE IF NOT EXISTS `kelompok` (
  `KDKEL` varchar(4) NOT NULL default '0',
  `NMKEL` varchar(25) default '0',
  PRIMARY KEY  (`KDKEL`)
) TYPE=MyISAM;

-- Data exporting was unselected.

-- Dumping structure for table cipta.kstock
CREATE TABLE IF NOT EXISTS `kstock` (
  `KdBar` varchar(13) default '0',
  `Tgl` date default '0000-00-00',
  `NoBukti` varchar(10) default NULL,
  `Qty` decimal(7,3) default '0.000',
  `Status` char(1) default '0',
  `Ket` varchar(5) default NULL,
  `kdGudang` varchar(4) default NULL,
  KEY `KdBar` (`KdBar`,`Tgl`),
  KEY `NoBukti` (`NoBukti`,`Ket`)
) TYPE=MyISAM;

-- Data exporting was unselected.

-- Dumping structure for table cipta.kunci
CREATE TABLE IF NOT EXISTS `kunci` (
  `KdUser` varchar(5) NOT NULL default '0',
  `Nmuser` varchar(20) default '0',
  `Pass` varchar(15) default '0',
  `HAK` varchar(30) default NULL,
  `HAK2` varchar(30) default NULL,
  `HAK3` varchar(70) default NULL,
  `HAK4` varchar(30) default NULL,
  `HAK5` varchar(30) default NULL,
  PRIMARY KEY  (`KdUser`),
  KEY `KdUser` (`KdUser`)
) TYPE=MyISAM;

-- Data exporting was unselected.

-- Dumping structure for table cipta.opname
CREATE TABLE IF NOT EXISTS `opname` (
  `Tgl` date default '0000-00-00',
  `Kdbar` varchar(13) default NULL,
  `StKomp` decimal(7,3) default '0.000',
  `StOpname` decimal(7,3) default '0.000',
  `Selisih` decimal(7,3) default '0.000',
  `Ket` varchar(30) default NULL,
  `HJUAL` decimal(12,2) default '0.00',
  `HBELI` decimal(12,2) default '0.00',
  `HPOKOK` decimal(12,2) default '0.00',
  KEY `Tgl` (`Tgl`)
) TYPE=MyISAM;

-- Data exporting was unselected.

-- Dumping structure for table cipta.pending
CREATE TABLE IF NOT EXISTS `pending` (
  `nofak` varchar(15) default '0',
  `tglfak` date default '0000-00-00',
  `kdkasir` varchar(5) default '0',
  `jam` time default '00:00:00',
  `total` decimal(12,2) default '0.00',
  `ppn` decimal(12,2) default '0.00',
  `Disc` decimal(5,2) default '0.00',
  `DiscRp` decimal(12,2) default '0.00',
  `GTotal` decimal(12,2) default '0.00',
  `KDANG` varchar(15) default NULL,
  KEY `nofak` (`tglfak`,`kdkasir`,`nofak`)
) TYPE=MyISAM;

-- Data exporting was unselected.

-- Dumping structure for table cipta.rbeli
CREATE TABLE IF NOT EXISTS `rbeli` (
  `NoFak` char(10) NOT NULL default '',
  `TglFak` date default '0000-00-00',
  `Ket` char(40) default NULL,
  `Total` decimal(10,2) NOT NULL default '0.00',
  `Pot1` decimal(5,2) NOT NULL default '0.00',
  `PotRp1` decimal(10,2) NOT NULL default '0.00',
  `Pot2` decimal(5,2) NOT NULL default '0.00',
  `PotRp2` decimal(10,2) NOT NULL default '0.00',
  `PPNPersen` decimal(5,2) NOT NULL default '0.00',
  `PPNRp` decimal(10,2) NOT NULL default '0.00',
  `GTotal` decimal(10,2) NOT NULL default '0.00',
  `Bayar` decimal(10,2) NOT NULL default '0.00',
  `Pos` char(1) default 'N',
  `Lain` decimal(10,2) NOT NULL default '0.00',
  `KDSUPP` char(15) default NULL,
  PRIMARY KEY  (`NoFak`)
) TYPE=MyISAM;

-- Data exporting was unselected.

-- Dumping structure for table cipta.rdbeli
CREATE TABLE IF NOT EXISTS `rdbeli` (
  `NoFak` varchar(10) default '0',
  `TglFak` date default '0000-00-00',
  `KdBar` varchar(13) default '0',
  `barcode` varchar(15) NOT NULL default '',
  `NmBar` varchar(30) default '0',
  `Satuan` varchar(7) default '0',
  `Qty` decimal(7,2) default '0.00',
  `Qtyz` decimal(7,2) default '0.00',
  `Hbeli` decimal(10,2) default '0.00',
  `Disc` decimal(5,2) default '0.00',
  `Jumlah` decimal(10,2) default '0.00',
  KEY `NoFak` (`NoFak`)
) TYPE=MyISAM;

-- Data exporting was unselected.

-- Dumping structure for table cipta.stock
CREATE TABLE IF NOT EXISTS `stock` (
  `KdBar` varchar(13) NOT NULL default '0',
  `Barcode` varchar(15) default '0',
  `Nmbar` varchar(50) default '0',
  `KdKel` varchar(4) default NULL,
  `Satkecil` varchar(7) default NULL,
  `HBeli` decimal(12,2) default '0.00',
  `HPokok` decimal(12,2) default '0.00',
  `HJual` decimal(12,2) default '0.00',
  `markup` decimal(10,5) NOT NULL default '0.00000',
  `HTetap` char(1) NOT NULL default 'N',
  `Mst` char(1) NOT NULL default 'N',
  `StMin` decimal(10,5) NOT NULL default '0.00000',
  `StMax` decimal(10,5) NOT NULL default '0.00000',
  `StAwal` decimal(10,2) NOT NULL default '0.00',
  `StMasuk` decimal(10,5) default '0.00000',
  `StKeluar` decimal(10,5) NOT NULL default '0.00000',
  `Konsi` char(1) default 'N',
  `Disc` decimal(5,2) default '0.00',
  `Foto` varchar(50) default NULL,
  `HJUAL2` decimal(10,2) NOT NULL default '0.00',
  `HJUAL3` decimal(10,2) NOT NULL default '0.00',
  `MARKUP2` decimal(10,5) NOT NULL default '0.00000',
  `MARKUP3` decimal(10,5) NOT NULL default '0.00000',
  `QTY2` decimal(7,2) NOT NULL default '0.00',
  `QTY3` decimal(7,2) NOT NULL default '0.00',
  `WARNA` varchar(20) NOT NULL default '',
  `UKURAN` varchar(10) NOT NULL default '',
  `KDSUPP` varchar(15) NOT NULL default '',
  `RAK` varchar(15) NOT NULL default '',
  PRIMARY KEY  (`KdBar`),
  KEY `Kdbar` (`KdBar`),
  KEY `Barcode` (`Barcode`)
) TYPE=MyISAM;

-- Data exporting was unselected.

-- Dumping structure for table cipta.supp
CREATE TABLE IF NOT EXISTS `supp` (
  `KdSupp` char(15) NOT NULL default '0',
  `NmSupp` char(30) NOT NULL default '0',
  `AlSupp` char(40) default NULL,
  `kota` char(15) default NULL,
  `Telp` char(15) default NULL,
  `CPerson` char(15) default NULL,
  `NPWP` char(20) default NULL,
  `Email` char(40) default NULL,
  `WPage` char(40) default NULL,
  PRIMARY KEY  (`KdSupp`),
  KEY `NmCust` (`NmSupp`)
) TYPE=MyISAM COMMENT='Master Data Supplier';

-- Data exporting was unselected.

-- Dumping structure for table cipta.tempbeli
CREATE TABLE IF NOT EXISTS `tempbeli` (
  `NoFak` char(10) NOT NULL default '0',
  `TglFak` date default '0000-00-00',
  `Ket` char(40) default NULL,
  `Total` decimal(12,2) default '0.00',
  `Pot1` decimal(5,2) default '0.00',
  `PotRp1` decimal(12,2) default '0.00',
  `Pot2` decimal(5,2) default '0.00',
  `PotRp2` decimal(12,2) default '0.00',
  `PPNPersen` decimal(5,2) default '0.00',
  `PPNRp` decimal(12,2) default '0.00',
  `GTotal` decimal(12,2) default '0.00',
  `Bayar` decimal(12,2) default '0.00',
  PRIMARY KEY  (`NoFak`)
) TYPE=MyISAM;

-- Data exporting was unselected.

-- Dumping structure for table cipta.tempcn
CREATE TABLE IF NOT EXISTS `tempcn` (
  `Nofak` varchar(10) default '0',
  `Gtotal` decimal(12,2) NOT NULL default '0.00',
  `Lain` decimal(12,2) NOT NULL default '0.00',
  `Bayar` decimal(12,2) NOT NULL default '0.00',
  `Sisa` decimal(12,2) NOT NULL default '0.00',
  `Sebesar` decimal(12,2) NOT NULL default '0.00',
  `Ket` varchar(30) default NULL,
  `SisaCN` decimal(12,2) NOT NULL default '0.00'
) TYPE=MyISAM;

-- Data exporting was unselected.

-- Dumping structure for table cipta.tempdbeli
CREATE TABLE IF NOT EXISTS `tempdbeli` (
  `NoFak` varchar(10) default '0',
  `TglFak` date default '0000-00-00',
  `KdBar` varchar(13) default NULL,
  `barcode` varchar(15) NOT NULL default '',
  `NmBar` varchar(30) default NULL,
  `Satuan` varchar(7) default NULL,
  `Qty` decimal(7,3) default '0.000',
  `Qtyz` decimal(7,3) default '0.000',
  `Hbeli` decimal(12,2) default '0.00',
  `Hbeliz` decimal(12,2) default '0.00',
  `Disc` decimal(5,2) default '0.00',
  `Jumlah` decimal(12,2) default '0.00',
  `HJUAL` decimal(10,2) NOT NULL default '0.00',
  `MARKUP` decimal(5,2) NOT NULL default '0.00',
  `HJUAL2` decimal(10,2) NOT NULL default '0.00',
  `MARKUP2` decimal(5,2) NOT NULL default '0.00',
  `HJUAL3` decimal(10,2) NOT NULL default '0.00',
  `MARKUP3` decimal(5,2) NOT NULL default '0.00',
  `QTY2` decimal(7,2) NOT NULL default '0.00',
  `QTY3` decimal(7,2) NOT NULL default '0.00',
  `MST` char(1) NOT NULL default 'N',
  KEY `NoFak` (`NoFak`)
) TYPE=MyISAM;

-- Data exporting was unselected.

-- Dumping structure for table cipta.tempdjual
CREATE TABLE IF NOT EXISTS `tempdjual` (
  `KdBar` varchar(13) default NULL,
  `Barcode` varchar(15) default NULL,
  `NmBar` varchar(30) default NULL,
  `Satuan` varchar(7) default NULL,
  `Qty` decimal(7,3) default '0.000',
  `Qtyz` decimal(7,3) default '0.000',
  `Hbeli` decimal(12,2) default '0.00',
  `HPokok` decimal(12,2) default '0.00',
  `HJual` decimal(12,2) default '0.00',
  `HJualz` decimal(12,2) default '0.00',
  `Disc` decimal(5,2) default '0.00',
  `Ppn` decimal(5,2) default '0.00',
  `Jumlah` decimal(12,2) default '0.00',
  `MST` char(1) NOT NULL default 'N'
) TYPE=MyISAM;

-- Data exporting was unselected.

-- Dumping structure for table cipta.tempjam
CREATE TABLE IF NOT EXISTS `tempjam` (
  `JAM` int(2) unsigned default '0',
  `FREKWENSI` decimal(3,0) default '0',
  `SALES` decimal(12,2) default '0.00'
) TYPE=MyISAM;

-- Data exporting was unselected.

-- Dumping structure for table cipta.tempjual
CREATE TABLE IF NOT EXISTS `tempjual` (
  `nofak` varchar(15) default '0',
  `tglfak` date default '0000-00-00',
  `kdkasir` varchar(4) default '0',
  `jam` time default '00:00:00',
  `total` decimal(12,2) default '0.00',
  `ppn` decimal(12,2) default '0.00',
  `ppnRp` decimal(12,2) default '0.00',
  `Disc` decimal(5,2) default '0.00',
  `DiscRp` decimal(12,2) default '0.00',
  `GTotal` decimal(12,2) default '0.00',
  `Bayar` decimal(12,2) default '0.00',
  `Kembali` decimal(12,2) default '0.00',
  `BCARD` decimal(5,2) default '0.00',
  `BCARDRP` decimal(10,2) default '0.00',
  `GTOTALC` decimal(10,2) default '0.00',
  KEY `nofak` (`tglfak`,`kdkasir`,`nofak`)
) TYPE=MyISAM;

-- Data exporting was unselected.

-- Dumping structure for table cipta.tempkasjual
CREATE TABLE IF NOT EXISTS `tempkasjual` (
  `Tgl` date default '0000-00-00',
  `KdUser` varchar(5) default NULL,
  `Awal` decimal(12,2) default '0.00',
  `Masuk` decimal(12,2) default '0.00',
  `Keluar` decimal(12,2) default '0.00',
  `Batal` decimal(10,2) NOT NULL default '0.00'
) TYPE=MyISAM;

-- Data exporting was unselected.

-- Dumping structure for table cipta.tempkstock
CREATE TABLE IF NOT EXISTS `tempkstock` (
  `Tgl` date default '0000-00-00',
  `NoBukti` varchar(10) default NULL,
  `Masuk` decimal(7,3) default '0.000',
  `Keluar` decimal(7,3) default '0.000',
  `Saldo` decimal(7,3) default '0.000',
  `Ket` varchar(20) default NULL,
  `KDUSER` varchar(5) default NULL,
  KEY `sTgl` (`Tgl`)
) TYPE=MyISAM;

-- Data exporting was unselected.

-- Dumping structure for table cipta.tempopname
CREATE TABLE IF NOT EXISTS `tempopname` (
  `StKomp` decimal(7,3) default '0.000',
  `StOpname` decimal(7,3) default '0.000',
  `Selisih` decimal(7,3) default '0.000',
  `HJUAL` decimal(12,2) default '0.00',
  `HBELI` decimal(12,2) default '0.00',
  `HPOKOK` decimal(12,2) default '0.00'
) TYPE=MyISAM;

-- Data exporting was unselected.

-- Dumping structure for table cipta.temprekstock
CREATE TABLE IF NOT EXISTS `temprekstock` (
  `KdKel` varchar(4) default '0',
  `NmKel` varchar(25) default '0',
  `THBELI` decimal(12,2) default '0.00',
  `PHBELI` decimal(5,2) default '0.00',
  `THPOKOK` decimal(12,2) default '0.00',
  `PHPOKOK` decimal(5,2) default '0.00',
  `THJUAL` decimal(12,2) default '0.00',
  `PHJUAL` decimal(5,2) default '0.00'
) TYPE=MyISAM;

-- Data exporting was unselected.

-- Dumping structure for table cipta.tempstock
CREATE TABLE IF NOT EXISTS `tempstock` (
  `Awal` decimal(7,3) default '0.000',
  `Masuk` decimal(7,3) default '0.000',
  `Keluar` decimal(7,3) default '0.000',
  `Akhir` decimal(7,3) default '0.000',
  `KAwal` decimal(7,3) default '0.000',
  `Kmasuk` decimal(7,3) default '0.000',
  `KKeluar` decimal(7,3) default '0.000',
  `KAkhir` decimal(7,3) default '0.000'
) TYPE=MyISAM;

-- Data exporting was unselected.

-- Dumping structure for table cipta.usaha
CREATE TABLE IF NOT EXISTS `usaha` (
  `NmUsaha` varchar(50) default NULL,
  `ALUsaha` varchar(50) default NULL,
  `Kota` varchar(50) default NULL,
  `Propinsi` varchar(50) default NULL,
  `Negara` varchar(50) default NULL,
  `KodePos` varchar(20) default NULL,
  `NoTelp` varchar(20) default NULL,
  `Nofax` varchar(20) default NULL,
  `NPWP` varchar(20) default NULL,
  `Email` varchar(50) default NULL,
  `Hpage` varchar(50) default NULL,
  `CetJual` char(1) default NULL,
  `CetBataljual` char(1) default NULL,
  `Cetbeli` char(1) default NULL,
  `CetSesuai` char(1) default NULL,
  `HNJual` char(1) default NULL,
  `FNJual` char(1) default NULL,
  `Headjual` varchar(50) default NULL,
  `FootJual` varchar(50) default NULL,
  `FootJual2` varchar(50) default NULL,
  `FootJual3` varchar(50) default NULL,
  `ceBold` char(1) default NULL,
  `chnCenter` char(1) default NULL,
  `ceNama` char(1) default NULL,
  `ceAlamat` char(1) default NULL,
  `ceKota` char(1) default NULL,
  `ceTelp` char(1) default NULL,
  `ChaCenter` char(1) default NULL,
  `CFbold` char(1) default NULL,
  `CFCenter` char(1) default NULL,
  `Qty` char(2) default NULL,
  `Uang` char(2) default NULL,
  `FakturAut` char(1) default NULL,
  `Barcode` char(1) default NULL,
  `Warna` char(1) default NULL,
  `QTYJUAL` decimal(5,0) NOT NULL default '0',
  `TGL` date default NULL,
  `DISC` decimal(5,2) NOT NULL default '0.00',
  `PPN` decimal(5,2) NOT NULL default '0.00',
  `STOCKWARNA` char(1) NOT NULL default '0',
  `STOCKUKURAN` char(1) NOT NULL default '0',
  `STOCKSUPP` char(1) NOT NULL default '0',
  `STOCKTEMPAT` char(1) NOT NULL default '0',
  `CENOFAX` char(1) NOT NULL default '0'
) TYPE=MyISAM;

-- Data exporting was unselected.

/*!40103 SET TIME_ZONE=IFNULL(@OLD_TIME_ZONE, 'system') */;
/*!40101 SET SQL_MODE=IFNULL(@OLD_SQL_MODE, '') */;
/*!40014 SET FOREIGN_KEY_CHECKS=IFNULL(@OLD_FOREIGN_KEY_CHECKS, 1) */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40111 SET SQL_NOTES=IFNULL(@OLD_SQL_NOTES, 1) */;
